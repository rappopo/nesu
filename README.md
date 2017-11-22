# @rappopo/nesu

This is **Nesu**, a CouchDB to Elasticsearch synchronizer, or CouchDB changes input plugin for Logstash "contender", or "CouchDB River Plugin resurrection", or whatever you want it to call.

## Setup as Command Line Tool

Run this to install **Nesu** as a global package:

    $ npm install -g @rappopo/nesu

Go to your project folder, and invoke:

    $ nesu

The first time **Nesu** starts, it'll create an empty *config.json* configuration file, *transformer* and *last_seq* folder in your project folder. Quit **Nesu** by pressing `Ctrl-c` and start customizing its configurations (please see details below).

## Setup as a Library

Go to your node.js application project folder, and type:

    $ npm install --save @rappopo/nesu

Create an empty new js file, e.g.: **nesu.js**, and enter the following code:

    var nesu = require('@rappopo/nesu')
    nesu()

Also create the *config.json* configuration file in the same folder as **nesu.js** file above like this example below:

    {
        "db": {
            "mydb1": {
                "idleTimeout": 0
            },
            "mydb2": {
                "cdb": {
                    "url": "http://couchdb:5984",
                    "name": "mycouchdb1"
                },
                "es": {
                    "url": "http://elasticsearch:9200",
                    "name": "myesindex1"
                },
                "bulkLimit": 500,
                "idleTimeout": 10
            }
        },
        "default": {
            "bulkLimit": 5000
        }
    }

And finaly: 

    $ node nesu.js

But most likely you'll want to use a process manager like **pm2**.

Program will automatically create an empty *config.js* file if missing. Two empty folders *transformer* and *last_seq* will also be created.

You might also want to change the configuration object above dynamically within your script, like this:

    ...
    nesu({ config: <config> })
    ...

The value of `<config>` will simply be merged with the above configuration file.

## Configuration File

You need to create/edit the configuration file *config.js* in the same folder as your bootstrap file. Please see the example above.

### Main Entries

`db.<mydb>.<prop>`: put your database info here. `<mydb>` is the name of CouchDB database you want to stream to Elasticsearch. Put as many databases you want here, **Nesu** will stream all away.

`default.<prop>`: serve as default properties. Will be used if none are provided in `db.<mydb>.<prop>` section.

### Properties

`bulkLimit`: max. number of documents in a bulk operation. Optional, defaults to 1000 documents

`idleTimeout`: how long to wait for a new changes to arrive. In seconds, optional, default to 2 seconds. If you put 0 in it, it'll use continuous stream provided by *nano.db.follow* instead of regular polling (*nano.db.changes*)

`cdb.url`: the url of your CouchDB server endpoint. Optional, defaults to http://localhost:5984

`cdb.name`: name of CouchDB database if different from the db's key name. Optional, defaults to the db's key

`es.url`: the url of your Elasticsearch endpoint. Optional, defaults to http://localhost:9200

`es.name`: name of Elasticsearch index if different from the db's key name. Optional, defaults to the db's key

`es.typeField`: document's key name to be used as Elasticsearch's type field. Optional, defaults to **doc**. 

## Transformer

You have the ability to transform each document to something new before written to Elasticsearch easily. 

All you need to do is just create a new js file inside the *transformer* folder with the exact name as its corresponding database. E.g. if your database name is *mydb*, than your transformer file will be *mydb.js*

And use the following code fragment as your start:

    module.exports = function(doc, callback) {
        .....
        callback(doc)
    }


## Last Sequence

Everytime a bulk of documents is written to Elasticsearch, its last sequence is saved in a file named after the database name, inside *last_seq* folder.

To reset the sequence from the very beginning, just delete the file. To start from an exact known sequence, just override its content. And to start from the actual one, put 'now' (without the quotes) in it

## License

(The MIT License)

Copyright © 2017 Ardhi Lukianto <ardhi@lukianto.com>

Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the “Software”), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED “AS IS”, WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
