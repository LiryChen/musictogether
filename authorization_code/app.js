var express = require('express');
var request = require('request');
var querystring = require('querystring');
var cookieParser = require('cookie-parser');
var promise = require('promise')
var bodyparser = require('body-parser');
var {Client} = require('pg');
var path = require('path')

var client_id = '06ed32358de243939f15040c7b609049';
var client_secret = 'abf66c65956b4a62b5b93ab096fd9960';
var redirect_uri = 'http://localhost:8888/callback';
var eventcode = ""
var stateKey = 'spotify_auth_state';
var app = express();
var current_state = ''
var global_authOptions = {}
var global_access_token = ''

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

/**
app.get('/', function(req, res){
  res.render('index.pug', {title: 'Articles'})
})
**/

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
  let get_host_id = function(){
      return new Promise(function(resolve, reject){
        var user_info_call = {
          url: 'https://api.spotify.com/v1/me/',
          headers: { 'Authorization': 'Bearer ' + global_access_token },
          json: true
        };
        request.get(user_info_call, function(error, response, body) {
          resolve(body.id)
        });
      })
  }
  let get_hosts_songs = function(host_id, host_playlist){
    var host_music_data = {data: []};
    var split_host_playlist = host_playlist[0].split(';')
    var playlist_id = split_host_playlist[split_host_playlist.length-2]
    var playlist_owner = split_host_playlist[split_host_playlist.length-1]
    var get_hosts_songs_call = {
      url: 'https://api.spotify.com/v1/users/'+playlist_owner+'/playlists/'+playlist_id+'/tracks',
      headers: { 'Authorization': 'Bearer ' + global_access_token },
      json: true
    };
    return new Promise(function(resolve, reject){
      request.get(get_hosts_songs_call, function(error, response, body) {
        for (item in body.items){
          var track = body.items[item].track
          var song_name = track.name
          var song_artists = track.artists
          var song_popularity = track.popularity
          var song_id = track.id
          host_music_data.data.push({
            "host_id": host_id, 
            "event_code": req.query.eventcode,
            "song_name": song_name,
            "song_artist": song_artists[0].name,
            "song_artists_id": song_artists[0].id,
            "song_popularity": song_popularity,
            "spotify_track_id": song_id
          });
       }
       resolve(host_music_data)
      });
    });
  }
  let get_track_features = function(host_data){
    var track_ids = ''
    for (track in host_data.data){
      track_ids = track_ids + host_data.data[track].spotify_track_id + ','
    }
    var get_track_features_call = {
          url: 'https://api.spotify.com/v1/audio-features?ids=' + track_ids,
          headers: { 'Authorization': 'Bearer ' + global_access_token },
          json: true
     };
    return new Promise(function(resolve, reject){
      request.get(get_track_features_call, function(error, response, body) {
        for (feature in body.audio_features){
          host_data.data[feature]['song_danceability'] = body.audio_features[feature].danceability
          host_data.data[feature]['song_tempo'] = body.audio_features[feature].tempo
        }
            resolve(host_data)
        });
    });
  }
  let insertInto_host_data = function(host_data){
    const client = new Client();
    client.connect().then(() =>{
      for (track_val in host_data.data){
        var sql = 'INSERT INTO public.host_data VALUES ($1, $2, $3, $4, $5, $6, $7)'
        var current_val = host_data.data[track_val]
        var params = [current_val.host_id, current_val.event_code,current_val.song_name, current_val.song_artist, current_val.song_popularity, current_val.song_danceability, current_val.song_tempo];
        client.query(sql, params);
      }
    })
  }

  
  const client = new Client();
  client.connect().then(() =>{
    var sql = 'INSERT INTO public.event_data VALUES ($1, $2, $3, $4, $5, $6)'
    var params = [req.query.eventname, req.query.eventlocation, req.query.duration, req.query.eventtype, req.query.genres, req.query.eventcode];
    client.query(sql, params);
  }).then(() => {
    get_host_id().then(function(host_id){
      get_hosts_songs(host_id, req.query.playlists).then(function(host_songs){
        get_track_features(host_songs).then(function(host_data_with_audio_features){
          insertInto_host_data(host_data_with_audio_features)
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

        //user functions        
        let get_user_id = function(){
              return new Promise(function(resolve, reject){
                var user_info_call = {
                  url: 'https://api.spotify.com/v1/me/',
                  headers: { 'Authorization': 'Bearer ' + access_token },
                  json: true
                };
                request.get(user_info_call, function(error, response, body) {
                  resolve(body.id)
                });
              });
        }    
        let get_user_music_data = function(user_id) {
            	var user_music_data = {data: []};

    	        var user_top_tracks_call = {
    	          url: 'https://api.spotify.com/v1/me/top/tracks?limit=50',
    	          headers: { 'Authorization': 'Bearer ' + access_token },
    	          json: true
    	        };
    	        
    	        return new Promise(function(resolve, reject){
    		        request.get(user_top_tracks_call, function(error, response, body) {
    		          for (item in body.items){
    		          	var song_name = body.items[item].name
    		          	var song_artists = body.items[item].artists
    		          	var song_popularity = body.items[item].popularity
    		          	var song_id = body.items[item].id
    		          	var song_features = []
    		          	user_music_data.data.push({
    		          		"user_id": user_id, 
    		          		"event_code": eventcode,
    		        		  "song_name": song_name,
    		        		  "song_artist": song_artists[0].name,
    		        		  "song_artists_id": song_artists[0].id,
    		        		  "song_popularity": song_popularity,
    		        		  "spotify_track_id": song_id
    		    		    });
    		    	   }
    		    	   resolve(user_music_data)
    		        });
    	        });
    	  }
    	  let get_track_features = function(user_data){
    	        var track_ids = ''
    	        for (track in user_data.data){
    	        	track_ids = track_ids + user_data.data[track].spotify_track_id + ','
    	        }
    	        var get_track_features_call = {
    			          url: 'https://api.spotify.com/v1/audio-features?ids=' + track_ids,
    			          headers: { 'Authorization': 'Bearer ' + access_token },
    			          json: true
    			     };
        			return new Promise(function(resolve, reject){
        				request.get(get_track_features_call, function(error, response, body) {
        					for (feature in body.audio_features){
        						user_data.data[feature]['song_danceability'] = body.audio_features[feature].danceability
        						user_data.data[feature]['song_tempo'] = body.audio_features[feature].tempo
        					}
        		        	resolve(user_data)
        			    });
        			});
    		}
    		let get_artist_genres = function(user_data){
    	        var artist_ids = ''
    	        for (track in user_data.data){
    	        	if (track == user_data.data.length-1){
    	        		artist_ids = artist_ids + user_data.data[track].song_artists_id
    	        	} else {
    	        		artist_ids = artist_ids + user_data.data[track].song_artists_id + ','
    	        	}
    	        }
    	        var get_artist_genres_call = {
    			          url: 'https://api.spotify.com/v1/artists?ids=' + artist_ids,
    			          headers: { 'Authorization': 'Bearer ' + access_token },
    			          json: true
    			     };
        			return new Promise(function(resolve, reject){
        				request.get(get_artist_genres_call, function(error, response, body) {
        					for (artist in body.artists){
        						user_data.data[artist]['song_genres'] = body.artists[artist].genres
        					}
        		        	resolve(user_data)
        			    });
        			});
    		}
        let get_genres = function(){
          const client = new Client();
          return new Promise(function(resolve, reject){
            client.connect().then(() =>{
              var sql = 'SELECT event_genres FROM event_data WHERE event_code = $1'
              client.query(sql, [eventcode]).then(function(events){
                resolve(events.rows[0].event_genres)
              })
            })
          })
        }
        let insertInto_user_data = function(user_data, genres){
        	const client = new Client();
      		client.connect().then(() =>{
      			for (track_val in user_data.data){
      				for(genre in genres){
      					if (user_data.data[track_val].song_genres.includes(genres[genre].toLowerCase())){
      						var sql = 'INSERT INTO public.user_data VALUES ($1, $2, $3, $4, $5, $6, $7, $8)'
      						var current_val = user_data.data[track_val]
      						var params = [current_val.user_id, current_val.event_code,current_val.song_name, current_val.song_artist, current_val.song_popularity, current_val.song_danceability, current_val.song_tempo, current_val.song_genres];
      						client.query(sql, params);
      						break;
      					}
      				}
      				continue
      			}
      		})
        }

        //host functions
        let get_host_playlists = function(){
          var host_playlists = {data: []};
          return new Promise(function(resolve, reject){
            var host_playlists_call = {
              url: 'https://api.spotify.com/v1/me/playlists',
              headers: { 'Authorization': 'Bearer ' + access_token },
              json: true
            };
            request.get(host_playlists_call, function(error, response, body) {
              for (playlist in body.items){
                host_playlists.data.push({
                      "playlist_id": body.items[playlist].id,  
                      "playlist_name": body.items[playlist].name,
                      "playlist_owner": body.items[playlist].owner.id
                    });
              }
              resolve(host_playlists)
            });
          });
        }
        let format_playlist = function(playlists){
          playlists = playlists.data
          var formatted_data = []
          for (playlist in playlists){
            formatted_data.push(playlists[playlist].playlist_name +";"+playlists[playlist].playlist_id + ";" + playlists[playlist].playlist_owner)
          }
          return formatted_data
        }
        if (current_state == 'user'){
    	    get_user_id().then(function(fromResolve){
    	    	get_user_music_data(fromResolve).then(function(user_data){
    	    		get_track_features(user_data).then(function(user_data_with_audio_feature){
    	    			get_artist_genres(user_data_with_audio_feature).then(function(user_data_with_everything){
                  get_genres().then(function(genres){
                    insertInto_user_data(user_data_with_everything, genres)
                    res.sendFile(__dirname + '/public/platform.html')
                  })
    	    			})
    	    		})
    	    	})
    	    }) 
        } else { //current_state == 'host'
            get_user_id().then(function(user_id){
              get_host_playlists().then(function(playlists){
                res.render('host.pug', {playlists: format_playlist(playlists)})
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



app.get('/refresh_token', function(req, res) {

  // requesting access token from refresh token
  var refresh_token = req.query.refresh_token;
  var authOptions = {
    url: 'https://accounts.spotify.com/api/token',
    headers: { 'Authorization': 'Basic ' + (new Buffer(client_id + ':' + client_secret).toString('base64')) },
    form: {
      grant_type: 'refresh_token',
      refresh_token: refresh_token
    },
    json: true
  };

  request.post(authOptions, function(error, response, body) {
    if (!error && response.statusCode === 200) {
      var access_token = body.access_token;
      res.send({
        'access_token': access_token
      });
    }
  });
});

console.log('Listening on 8888');
app.listen(8888);
