var fs = require('fs-extra'),
  _ = require('lodash'),
  async = require('async'),
  elasticsearch = require('elasticsearch'),
  es = new elasticsearch.Client({
    hosts: 'localhost:9200',
    apiVersion: '5.6'
  }),
  cfg = {
    db: {},
    default: {
      cdb: {
        url: 'http://localhost:5984'
      },
      es: {
        url: 'http://localhost:9200',
        typeField: 'type'
      },
      bulkLimit: 1000,
      idleTimeout: 2
    }
  }

function now() {
  var date = new Date()
  return date.toISOString()
}

function quit(text) {
  console.log('%s - %s', now(), text)
  process.exit()
}

function processBulk(param, callback) {
  var bulk = []
  async.mapSeries(param.body.results, function(item, callb){
    var type = item.doc[param.db.es.typeField] || 'doc',
      head = { _type: type, _id: item.doc._id }
    async.setImmediate(function(){
      param.db.transformer(item.doc, function(doc) {
        if (doc._deleted) {
          bulk.push({ delete: head })
        } else {
          bulk.push({ index: head})
          bulk.push(doc)
        }
        callb()      
      })      
    })
  }, function() {
    if (bulk.length === 0) {
      setTimeout(function() {
        console.log('%s - %s - Noop', now(), param.db.name)
        callback()      
      }, 1000 * (param.db.idleTimeout || 2000))
    } else {
      param.es.bulk({
        refresh: 'true',
        index: param.db.es.name,
        body: bulk
      }, function(err, resp) {
        if (err) return callback(err)
        try {
          fs.writeFileSync(param.seqFile, param.body.last_seq, 'utf8')
        } catch(e) {}
        console.log('%s - %s - Took: %s, Last Seq: %s', now(), param.db.name, resp.took, param.body.last_seq)
        callback()
      })
    }    
  })
}

function polling(db, nano, es, seqFile) {
  var since = '0'
  async.forever(
    function(next) {
      process.nextTick(function() {
        try {
          since = _.trim(fs.readFileSync(seqFile, 'utf8'))
        } catch(e) {}
        nano.db.changes(db.cdb.name, {
          limit: db.bulkLimit || 1000,
          since: since,
          include_docs: true
        }, function(err, body) {
          if (err) return next(err)
          processBulk({
            db: db,
            body: body, 
            es: es,
            seqFile: seqFile
          }, next)
        })
      })
    },
    function(err) {
      quit('%s - Error: %s', db.name, err.message)
    }
  )
}

function continuous(db, nano, es, seqFile) {
  var since = '0', rsec = 0
  try {
    since = _.trim(fs.readFileSync(seqFile, 'utf8'))
  } catch(e) {}
  var bulk = []
  var feed = nano.db.follow(db.cdb.name, {
    since: since,
    include_docs: true,
  })

  setInterval(function(){
    if (rsec >= 10) {
      rsec = 0
      if (bulk.length > 0) {
        processBulk({
          db: db,
          body: {
            results: bulk,
            last_seq: _.last(bulk).seq
          },
          es: es,
          seqFile: seqFile
        }, function(err){
          bulk = []
        })        
      }      
    }
    rsec++
  }, 100)

  function bulkPush(change) {
    bulk.push({
      seq: change.seq,
      doc: change.doc
    })
  }

  feed.on('change', function(change) {
    rsec = 0
    var f = this, last_seq = change.seq
    f.pause()
    process.nextTick(function(){
      if (bulk.length >= db.bulkLimit) {
        processBulk({
          db: db,
          body: {
            results: bulk,
            last_seq: _.last(bulk).seq
          },
          es: es,
          seqFile: seqFile
        }, function(err){
          bulk = []
          bulkPush(change)
          f.resume()
        })
      } else {
        bulkPush(change)
        f.resume()
      }
    })
  })
  feed.follow()
}

function sync(db, callback) {
  var nano = require('nano')(db.cdb.url || cfg.default.cdb.url),
    es = new elasticsearch.Client({
      host: db.es.url || cfg.default.es.url,
      apiVersion: db.es.apiVersion || cfg.default.es.apiVersion || '5.6'
    })

  nano.db.get(db.cdb.name, function(err) {
    if (err) {
      console.log('%s - %s - CouchDB Err: %s', now(), db.name, err.message)
      return callback()
    }
    es.indices.exists({ index: db.es.name }, function(err, resp, status) {
      if (!resp) {
        console.log('%s - %s - Elasticsearch Err: DB Not Found', now(), db.name)
        return callback()        
      }
      var seqFile = process.cwd() + '/last_seq/' + db.name + '.txt'
      if (db.idleTimeout > 0) {
        polling(db, nano, es, seqFile)
      } else {
        continuous(db, nano, es, seqFile)
      }
      callback()
    })
  })
}

module.exports = function(param) {
  param = param || {}
  fs.ensureDirSync(process.cwd() + '/last_seq')
  fs.ensureDirSync(process.cwd() + '/transformer')
  try {
    fs.accessSync(process.cwd() + '/config.json')
  } catch(e) {
    fs.writeJsonSync(process.cwd() + '/config.json', {}, { spaces: 2 })
  }
  try {
    cfg = _.merge(cfg, require(process.cwd() + '/config.json'))
  } catch(e) {
    quit(e.message)
  }

  if (_.isEmpty(cfg)) quit('Unable to load configuration')

  if (param.config) cfg = _.merge(cfg, param.config)
  if (_.isEmpty(_.keys(cfg.db))) quit('No database to sync')

  async.mapSeries(_.keys(cfg.db), function(c, callback) {
    var db = cfg.db[c]
    db.name = c
    db.cdb = db.cdb || cfg.default.cdb
    db.cdb.name = db.cdb.name || c
    db.es = db.es || cfg.default.es
    db.es.name = db.es.name || c
    db.idleTimeout = _.has(db, 'idleTimeout') ? db.idleTimeout : cfg.default.idleTimeout
    db.bulkLimit = _.has(db, 'bulkLimit') ? db.bulkLimit : cfg.default.bulkLimit
    db.transformer = function(doc, cb) { 
      delete doc._id
      delete doc._rev
      cb(doc) 
    }
    try {
      db.transformer = require(process.cwd() + '/transformer/' + db.name + '.js')
    } catch(e) {}
    sync(db, callback)
  }, function(e, r) {
    console.log('**** enter the loop ****')
  })
}
