//npm variables
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
var app = express();

//spotify connection
var client_id = '06ed32358de243939f15040c7b609049';
var client_secret = 'abf66c65956b4a62b5b93ab096fd9960';
var redirect_uri = 'http://localhost:8888/callback';
var stateKey = 'spotify_auth_state';

//global variables
var global_state = ''
var global_authOptions = {}
var global_access_token = ''
var global_eventduration = 0
var global_eventtype = ''
var global_eventcode = ''


var generateRandomString = function(length) {
  var text = '';
  var possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';

  for (var i = 0; i < length; i++) {
    text += possible.charAt(Math.floor(Math.random() * possible.length));
  }
  return text;
};

app.set('views', path.join(__dirname, '/public/pages'));
app.use(express.static(__dirname + '/public'))
   .use(cookieParser());

app.get('/', function(req, res){
  res.render(__dirname + '/public/pages/login.pug')

  

})

app.get('/db', function(req, res){
  dbOperations.methods.retrieve_user_data(global_eventcode).then(function(fromResolve){
    var temp = {"data": []}
    for (row in fromResolve.rows){
      temp.data.push({
        "Title": fromResolve.rows[row].song_name,  
        "Artist": fromResolve.rows[row].song_artists,
        "Count": fromResolve.rows[row].count,
        "Tempo": fromResolve.rows[row].song_tempo,
        "Popularity": fromResolve.rows[row].song_popularity,
        "Danceability": fromResolve.rows[row].song_danceability
      });
    }
    temp = JSON.stringify(temp)
    res.send(temp)
  })
})

app.get('/host', function(req, res){
  global_state = 'host'
  var state = generateRandomString(16);
  res.cookie(stateKey, state);
  var scope = 'user-library-read user-library-modify user-read-private user-read-email user-top-read playlist-read-private';
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
  if ((typeof req.query.genres) == 'string'){
    req.query.genres = [req.query.genres]
  }
  console.log(req.query.genres)
  global_eventtype = req.query.eventtype
  global_eventcode = req.query.eventcode
  global_eventduration = req.query.duration
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
          res.render(__dirname + '/public/pages/dashboard.pug')
        })
      })
    })
  }) 
})

app.get('/userinput', function(req, res){
  console.log(req.query)

  spotifyOperations.methods.get_user_id(global_access_token).then(function(id){
    dbOperations.methods.hasAlreadyInputted(id).then(function(num_user_ids){
      if (num_user_ids == 0){ //change for testing
        if (req.query["top_songs"] != undefined){
          spotifyOperations.methods.get_user_id(global_access_token).then(function(fromResolve){
            spotifyOperations.methods.get_user_music_data(fromResolve, global_access_token, global_eventcode).then(function(user_data){
              spotifyOperations.methods.get_track_features(user_data, global_access_token).then(function(user_data_with_audio_feature){
                spotifyOperations.methods.get_artist_genres(user_data_with_audio_feature, global_access_token).then(function(user_data_with_everything){
                  dbOperations.methods.get_genres(global_eventcode).then(function(genres){
                    dbOperations.methods.fetch_user_data().then(function(fetched_user_data){
                      dbOperations.methods.insertInto_user_data(fetched_user_data, user_data_with_everything, genres)
                    })
                    
                  })
                })
              })
            })
          }) 
        }
  
  if (req.query["saved_songs"] != undefined){
      spotifyOperations.methods.get_user_id(global_access_token).then(function(fromResolve){
        spotifyOperations.methods.get_user_saved_songs(fromResolve, global_access_token, global_eventcode).then(function(user_data){
          spotifyOperations.methods.get_track_features(user_data, global_access_token).then(function(user_data_with_audio_feature){
                spotifyOperations.methods.get_artist_genres(user_data_with_audio_feature, global_access_token).then(function(user_data_with_everything){
                  dbOperations.methods.get_genres(global_eventcode).then(function(genres){
                    dbOperations.methods.fetch_user_data().then(function(fetched_user_data){
                      dbOperations.methods.insertInto_user_data(fetched_user_data, user_data_with_everything, genres)
                    })
                    
                  })
                })
              })
        })
      })
  }
  

  if (req.query["playlists"] != undefined){
    var playlist = [req.query["playlists"] + ''];
    spotifyOperations.methods.get_user_id(global_access_token).then(function(fromResolve){
      spotifyOperations.methods.get_user_playlist_songs(fromResolve, playlist, global_access_token, global_eventcode).then(function(user_data){
        spotifyOperations.methods.get_track_features(user_data, global_access_token).then(function(user_data_with_audio_feature){
                spotifyOperations.methods.get_artist_genres(user_data_with_audio_feature, global_access_token).then(function(user_data_with_everything){
                  dbOperations.methods.get_genres(global_eventcode).then(function(genres){
                    dbOperations.methods.fetch_user_data().then(function(fetched_user_data){
                      dbOperations.methods.insertInto_user_data(fetched_user_data, user_data_with_everything, genres)
                    })
                    
                  })
                })
              })
      })
    })
  }
      }
    })
  })

	
  
  
  
	res.render(__dirname + '/public/pages/dashboard.pug')
})

app.get('/dashboard.pug', function(req, res){
  console.log('current state' + global_state)		
  res.render(__dirname + '/public/pages/dashboard.pug')
})
app.get('/importedsongs.pug', function(req, res){
	console.log('current state' + global_state)
  res.render(__dirname + '/public/pages/importedsongs.pug')
})
app.get('/djprofile.pug', function(req, res){
	console.log('current state' + global_state)
  res.render(__dirname + '/public/pages/djprofile.pug')
})
app.get('/smartplaylist.pug', function(req, res){
	console.log('current state' + global_state)
  res.render(__dirname + '/public/pages/smartplaylist.pug', {eventtype: global_eventtype})
})
app.get('/login.pug', function(req, res){
	console.log('current state' + global_state)
  res.render(__dirname + '/public/pages/login.pug')
})

app.get('/login', function(req, res) {
  global_state = 'user'
  global_eventcode = res.req.query.eventcode
  const client = new Client();
  client.connect().then(() =>{
    var sql = 'SELECT event_code, event_type FROM event_data WHERE event_code = $1'
    var param = [global_eventcode]
    client.query(sql, param).then(function(events){
      
      if(events.rowCount == 0){
        console.log('Event code doesnt exist')
        res.render(__dirname + '/public/pages/login.pug')
      } else {
        global_eventtype = events.rows[0].event_type
        var state = generateRandomString(16);
        res.cookie(stateKey, state);
        var scope = 'user-library-read user-library-modify user-read-private user-read-email user-top-read playlist-read-private';
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
  console.log("Current State: " + global_state)
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
        if (global_state == 'user'){
        	spotifyOperations.methods.get_user_id(access_token).then(function(user_id){
            	dbOperations.methods.get_host_playlists(access_token).then(function(playlists){
              		res.render(__dirname + '/public/pages/userinput.pug', {playlists: spotifyOperations.methods.format_playlist(playlists)})
            	})
          	})	
        } else { //global_state == 'host'
          spotifyOperations.methods.get_user_id(access_token).then(function(user_id){
            dbOperations.methods.get_host_playlists(access_token).then(function(playlists){
              res.render(__dirname + '/public/pages/host.pug', {playlists: spotifyOperations.methods.format_playlist(playlists)})
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
