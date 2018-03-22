/**
 * This is an example of a basic node.js script that performs
 * the Authorization Code oAuth2 flow to authenticate against
 * the Spotify Accounts.
 *
 * For more information, read
 * https://developer.spotify.com/web-api/authorization-guide/#authorization_code_flow
 */

var express = require('express'); // Express web server framework
var request = require('request'); // "Request" library
var querystring = require('querystring');
var cookieParser = require('cookie-parser');
var promise = require('promise')
var bodyparser = require('body-parser');
var {Client} = require('pg');

var client_id = '06ed32358de243939f15040c7b609049'; // Your client id
var client_secret = 'abf66c65956b4a62b5b93ab096fd9960'; // Your secret
var redirect_uri = 'http://localhost:8888/callback'; // Your redirect uri

/**
 * Generates a random string containing numbers and letters
 * @param  {number} length The length of the string
 * @return {string} The generated string
 */
var generateRandomString = function(length) {
  var text = '';
  var possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';

  for (var i = 0; i < length; i++) {
    text += possible.charAt(Math.floor(Math.random() * possible.length));
  }
  return text;
};

var stateKey = 'spotify_auth_state';

var app = express();
var eventcode = ""
app.use(express.static(__dirname + '/public'))
   .use(cookieParser());

app.get('/login', function(req, res) {
  var state = generateRandomString(16);
  res.cookie(stateKey, state);
  //var nameValue = app.getElementById("eventcode").value;
  eventcode = res.req.query.eventcode
  // your application requests authorization
  var scope = 'user-read-private user-read-email user-top-read';
  res.redirect('https://accounts.spotify.com/authorize?' +
    querystring.stringify({
      response_type: 'code',
      client_id: client_id,
      scope: scope,
      redirect_uri: redirect_uri,
      state: state
    }));
});


app.get('/callback', function(req, res) {

  // your application requests refresh and access tokens
  // after checking the state parameter
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

    request.post(authOptions, function(error, response, body) {
      if (!error && response.statusCode === 200) {

        var access_token = body.access_token,
            refresh_token = body.refresh_token;

        

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
	          url: 'https://api.spotify.com/v1/me/top/tracks?limit=100',
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
		        		"song_artists": song_artists,
		        		"song_popularity": song_popularity,
		        		"spotify_track_id": song_id
		    		});
		    	   }
		    	   resolve(user_music_data)
		        });
	        });
	    }

	    let insertInto_user_data = function(user_data){
	    	const client = new Client();
    		client.connect().then(() =>{
    			for (track_val in user_data.data){
    				var sql = 'INSERT INTO public.user_data VALUES ($1, $2, $3, $4, $5, $6)'
    				var current_val = user_data.data[track_val]
    				var params = [current_val.user_id, current_val.event_code,current_val.song_name, current_val.song_artists[0].name, current_val.song_popularity, current_val.spotify_track_id];
    				client.query(sql, params);
    			}
    		})
	    }

	    get_user_id().then(function(fromResolve){
	    	get_user_music_data(fromResolve).then(function(user_data){
	    		insertInto_user_data(user_data);
	    	})
	    })
	    /**
	    get_user_top_tracks().then(function(result){
	    	console.log(result)
	    	var track_id = 0
	    	while (track_id < result.tracks.length){
	    		//console.log(result.tracks[track_id].spotify_track_id)
	    		var song_features_call = {
	          			url: 'https://api.spotify.com/v1/audio-features/' + result.tracks[track_id].spotify_track_id,
	          			headers: { 'Authorization': 'Bearer ' + access_token },
	          			json: true
	        	};
	        	let mypromise = new Promise(function(resolve, reject){
	        		request.get(song_features_call, function(error, response, body){
	    					song_danceability = body.danceability
	    					song_tempo = body.tempo
	    					resolve(song_danceability)
    				});
	        	})
	        	mypromise.then(function(fromResolve){
	        		console.log(fromResolve)
	        	})
	        	track_id = track_id + 1
	    	}	
	    })
	    **/
        
        // we can also pass the token to the browser to make requests from there
        res.redirect('/#' +
          querystring.stringify({
            access_token: access_token,
            refresh_token: refresh_token
          }));
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


//functions
/**
    		arr_danceability = [];
    		for (track in user_top_tracks.tracks){
    			var song_features_call = {
          			url: 'https://api.spotify.com/v1/audio-features/' + user_top_tracks.tracks[track].spotify_track_id,
          			headers: { 'Authorization': 'Bearer ' + access_token },
          			json: true
        		};
    			console.log(user_top_tracks.tracks[track].spotify_track_id)

    		
				var promiseToCleanTheRoom = new Promise(function(resolve, reject){
	    			request.get(song_features_call, function(error, response, body){
	    				song_danceability = body.danceability
	    				song_tempo = body.tempo
	    				resolve(song_danceability)
	    			});
	    		});
    			promiseToCleanTheRoom.then(function(fromResolve){
    				arr_danceability.push(fromResolve)
    				console.log(arr_danceability)
    			})

            }
			**/

console.log('Listening on 8888');
app.listen(8888);
