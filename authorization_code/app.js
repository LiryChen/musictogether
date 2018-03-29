var express = require('express');
var request = require('request');
var querystring = require('querystring');
var cookieParser = require('cookie-parser');
var promise = require('promise')
var bodyparser = require('body-parser');
var {Client} = require('pg');
var path = require('path')
var dbOperations = require('./dataoperations.js')
var spotifyOperations = require('./spotifyoperations.js')

var client_id = '06ed32358de243939f15040c7b609049';
var client_secret = 'abf66c65956b4a62b5b93ab096fd9960';
var redirect_uri = 'http://localhost:8888/callback';
var stateKey = 'spotify_auth_state';
var app = express();
var current_state = ''
var global_authOptions = {}
var global_access_token = ''
var eventcode = ''

var generateRandomString = function(length) {
  var text = '';
  var possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';

  for (var i = 0; i < length; i++) {
    text += possible.charAt(Math.floor(Math.random() * possible.length));
  }
  return text;
};

app.set('views', path.join(__dirname, 'public'));
app.set('view engine', 'pug');

app.use(express.static(__dirname + '/public'))
   .use(cookieParser());

app.get('/host', function(req, res){
  current_state = 'host'
  var state = generateRandomString(16);
  res.cookie(stateKey, state);
  var scope = 'user-read-private user-read-email user-top-read playlist-read-private';
  res.redirect('https://accounts.spotify.com/authorize?' +
    querystring.stringify({
      response_type: 'code',
      client_id: client_id,
      scope: scope,
      redirect_uri: redirect_uri,
      state: state
  }));
})

app.get('/platform', function(req, res){
  const client = new Client();
  client.connect().then(() =>{
    var sql = 'INSERT INTO public.event_data VALUES ($1, $2, $3, $4, $5, $6)'
    var params = [req.query.eventname, req.query.eventlocation, req.query.duration, req.query.eventtype, req.query.genres, req.query.eventcode];
    client.query(sql, params);
  }).then(() => {
    spotifyOperations.methods.get_host_id(global_access_token).then(function(host_id){
      spotifyOperations.methods.get_hosts_songs(host_id, req.query.playlists, global_access_token, req.query.eventcode).then(function(host_songs){
        spotifyOperations.methods.get_track_features(host_songs, global_access_token).then(function(host_data_with_audio_features){
          dbOperations.methods.insertInto_host_data(host_data_with_audio_features)
          dbOperations.methods.retrieve_user_data().then(function(user_data){
            console.log(user_data)
          })
        })
      })
    })
  })
  res.sendFile(__dirname + '/public/platform.html')
})

app.get('/login', function(req, res) {
  current_state = 'user'
  eventcode = res.req.query.eventcode
  const client = new Client();
  client.connect().then(() =>{
    var sql = 'SELECT event_code FROM event_data WHERE event_code = $1'
    var param = [eventcode]
    client.query(sql, param).then(function(events){
      if(events.rowCount == 0){
        console.log('Event code doesnt exist')
        res.sendFile(__dirname + '/public/index.html')
        //todo: add a javascript alert telling the user to give a valid code and resubmit 
      } else {
        var state = generateRandomString(16);
        res.cookie(stateKey, state);
        var scope = 'user-read-private user-read-email user-top-read';
        res.redirect('https://accounts.spotify.com/authorize?' +
          querystring.stringify({
            response_type: 'code',
            client_id: client_id,
            scope: scope,
            redirect_uri: redirect_uri,
            state: state
        }));
      }
    })
  })
});


app.get('/callback', function(req, res) {
  console.log("Current State: " + current_state)
  var code = req.query.code || null;
  var state = req.query.state || null;
  var storedState = req.cookies ? req.cookies[stateKey] : null;
  if (state === null || state !== storedState) {
    res.redirect('/#' +
      querystring.stringify({
        error: 'state_mismatch'
      }));
  } else {
    res.clearCookie(stateKey);
    var authOptions = {
      url: 'https://accounts.spotify.com/api/token',
      form: {
        code: code,
        redirect_uri: redirect_uri,
        grant_type: 'authorization_code'
      },
      headers: {
        'Authorization': 'Basic ' + (new Buffer(client_id + ':' + client_secret).toString('base64'))
      },
      json: true
    };
    global_authOptions = authOptions
    request.post(authOptions, function(error, response, body) {
      if (!error && response.statusCode === 200) {
        var access_token = body.access_token,
            refresh_token = body.refresh_token;
        global_access_token = access_token
        if (current_state == 'user'){
    	    spotifyOperations.methods.get_user_id(access_token).then(function(fromResolve){
    	    	spotifyOperations.methods.get_user_music_data(fromResolve, access_token, eventcode).then(function(user_data){
    	    		spotifyOperations.methods.get_track_features(user_data, access_token).then(function(user_data_with_audio_feature){
    	    			spotifyOperations.methods.get_artist_genres(user_data_with_audio_feature, access_token).then(function(user_data_with_everything){
                  dbOperations.methods.get_genres(eventcode).then(function(genres){
                    dbOperations.methods.insertInto_user_data(user_data_with_everything, genres)
                    res.sendFile(__dirname + '/public/platform.html')
                  })
    	    			})
    	    		})
    	    	})
    	    }) 
        } else { //current_state == 'host'
          spotifyOperations.methods.get_user_id(access_token).then(function(user_id){
            dbOperations.methods.get_host_playlists(access_token).then(function(playlists){
              res.render('host.pug', {playlists: spotifyOperations.methods.format_playlist(playlists)})
            })
          })
        }
      } else {
        res.redirect('/#' +
          querystring.stringify({
            error: 'invalid_token'
          }));
      }
    });
  }
});

console.log('Listening on 8888');
app.listen(8888);
