var express = require('express'); // require Express
var router = express.Router(); // setup usage of the Express router engine
var config = require('config'); 
/* PostgreSQL and PostGIS module and connection setup */
var pg = require("pg"); // require Postgres module

// Setup connection
// connection string  with special character handling in user and password
conString = {
    user: config.dayplanner.dbConfig.username,
    password: config.dayplanner.dbConfig.password,
    database: config.dayplanner.dbConfig.dbName,
    port: config.dayplanner.dbConfig.port,
    host: config.dayplanner.dbConfig.host,
    ssl: true
};

/* GET home page. */
router.get('/', function (req, res, next) {
    res.render('dayplanner', { title: 'Express' });
});

router.get('/data', function (req, res) {
    var client = new pg.Client(conString);
    client.connect();
    var query = client.query(coffee_query);
    query.on("row", function (row, result) {
        result.addRow(row);
    });
    query.on("end", function (result) {
        res.send(result.rows[0].row_to_json);
        res.end();
    });
});


router.put('/insert_data', (req, res, next) => {
    const results = [];
    // Get a Postgres client from the connection pool
    pg.connect(conString, (err, client, done) => {
        // Handle connection errors
        if (err) {
            done();
            console.log(err);
            return res.status(500).json({ success: false, data: err });
        }
        var str = "INSERT INTO engagements(loc_name, title, date, start_time, end_time, location) VALUES ('" + req.body.loc_name + "', '" + req.body.title + "', '" + req.body.meeting_date + "', '" + req.body.start_time + "', '" + req.body.end_time + "', point('" + req.body.lat + "', '" + req.body.long + "'))";        
        var query = client.query(str);
        // Stream results back one row at a time
        console.log(results);
        query.on('row', (row) => {
            results.push(row);
        });
        // After all data is returned, close connection and return results
        query.on('end', () => {
            done();
            return res.json(results);
        });
    });

});


router.get('/api/v1/GetMeetingData', (req, res, next) => {
    const results = [];
    const meeting_date = req.query.meeting_date;

    // Get a Postgres client from the connection pool
    pg.connect(conString, (err, client, done) => {
        // Handle connection errors
        if (err) {
            done();
            console.log(err);
            return res.status(500).json({ success: false, data: err });
        }

         // SQL Query > Select Data

         //verifying request data for sql injection
        if (meeting_date.indexOf("--") > -1 || meeting_date.indexOf("'") > -1 || meeting_date.indexOf(";") > -1 || meeting_date.indexOf("/*") > -1 || meeting_date.indexOf("xp_") > -1) {
            console.log("Bad request detected");
            res.redirect('/map');
            return;
        }
        //const query = client.query("select array_to_json(array_agg(row_to_json(t))) as meeting_data from (select loc_id, loc_name, subject, meeting_date, TO_CHAR(start_time, 'HH12:MI AM') start_time, TO_CHAR(end_time, 'HH12:MI AM') end_time, ST_AsGeoJSON(geog)::json As geometry from meeting_details where meeting_date = $1 ORDER BY TO_CHAR(start_time, 'HH12:MI AM') ASC ) as t;", [meeting_date]);
          //const query = client.query("select array_to_json(array_agg(row_to_json(t))) as meeting_data from (select loc_id, loc_name, subject, meeting_date, TO_CHAR(start_time, 'HH12:MI AM') start_time, TO_CHAR(end_time, 'HH12:MI AM') end_time, ST_AsGeoJSON(location)::json As geometry from meeting where meeting_date = $1 ORDER BY TO_CHAR(start_time, 'HH12:MI AM') ASC ) as t;", [meeting_date]);
        const query = client.query("select array_to_json(array_agg(row_to_json(t))) as meeting_data from (select loc_id, loc_name, title, date, to_char(start_time::time, 'HH12:MI AM') as start, to_char(end_time::time, 'HH12:MI AM') as end, location from engagements where date = $1 ORDER BY start_time ) as t;", [meeting_date]);

        // Stream results back one row at a time
        query.on('row', (row) => {
            results.push(row);
        });

        // After all data is returned, close connection and return results
        query.on('end', () => {
            done();
            return res.json(results[0].meeting_data);
        });
    });
});



/* GET the map page */
router.get('/map', function (req, res) {
    var client = new pg.Client(conString); // Setup our Postgres Client
    client.connect(); // connect to the client
    var query = client.query(coffee_query); // Run our Query
    query.on("row", function (row, result) {
        result.addRow(row);
    });
    // Pass the result to the map page
    query.on("end", function (result) {
        var data = result.rows[0].row_to_json // Save the JSON as variable data
        res.render('map', {
            title: "Express API", // Give a title to our page
            jsonData: data // Pass data to the View
        });
    });
});

/* GET the filtered page */
router.get('/filter*', function (req, res) {
    var name = req.query.name;
    if (name.indexOf("--") > -1 || name.indexOf("'") > -1 || name.indexOf(";") > -1 || name.indexOf("/*") > -1 || name.indexOf("xp_") > -1) {
        console.log("Bad request detected");
        res.redirect('/map');
        return;
    } else {
        console.log("Request passed")
        var filter_query = "SELECT row_to_json(fc) FROM ( SELECT 'FeatureCollection' As type, array_to_json(array_agg(f)) As features FROM (SELECT 'Feature' As type, ST_AsGeoJSON(lg.geom)::json As geometry, row_to_json((id, name)) As properties FROM cambridge_coffee_shops As lg WHERE lg.name = \'" + name + "\') As f) As fc";
        var client = new pg.Client(conString);
        client.connect();
        var query = client.query(filter_query);
        query.on("row", function (row, result) {
            result.addRow(row);
        });
        query.on("end", function (result) {
            var data = result.rows[0].row_to_json
            res.render('map', {
                title: "Express API",
                jsonData: data
            });
        });
    };
});

module.exports = router;