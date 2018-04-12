var express = require('express');
var request = require('request');
var querystring = require('querystring');
var cookieParser = require('cookie-parser');
var promise = require('promise')
var bodyparser = require('body-parser');
var {Client} = require('pg');
var path = require('path')

var methods = {
	retrieve_user_data: function(event_code){
		return new Promise(function(resolve, reject){
		  const client = new Client();
		  var sql = 'SELECT user_data.song_name, song_artists, COUNT(song_name), song_tempo, song_popularity, song_danceability FROM user_data WHERE event_code = $1 GROUP BY song_name, song_artists, song_tempo, song_popularity, song_danceability'
		    var params = [event_code]
		  client.connect().then(() =>{
		    
		    client.query(sql, params).then(res => {
		      resolve(res)
		      // { name: 'brianc', email: 'brian.m.carlson@gmail.com' }
		      }).catch(e => console.error(e.stack))
		  })
		})
  	},
	insertInto_host_data: function(host_data){
		const client = new Client();
		client.connect().then(() =>{
		  for (track_val in host_data.data){
		    var sql = 'INSERT INTO public.host_data VALUES ($1, $2, $3, $4, $5, $6, $7)'
		    var current_val = host_data.data[track_val]
		    var params = [current_val.host_id, current_val.event_code,current_val.song_name, current_val.song_artist, current_val.song_popularity, current_val.song_danceability, current_val.song_tempo];
		    client.query(sql, params);
		  }
		})
  	},
  	get_host_playlists: function(access_token){
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
    },
    get_genres: function(eventcode){
          const client = new Client();
          return new Promise(function(resolve, reject){
            client.connect().then(() =>{
              var sql = 'SELECT event_genres FROM event_data WHERE event_code = $1'
              client.query(sql, [eventcode]).then(function(events){
                resolve(events.rows[0].event_genres)
              })
            })
          })
        },
     fetch_user_data: function(){
          const client = new Client();
          return new Promise(function(resolve, reject){
            client.connect().then(() =>{
              var sql = 'SELECT song_name FROM user_data'
              client.query(sql).then(function(events){
                var result = events.rows.reduce(function(map, obj) {
                  map[obj.song_name] = obj.song_name;
                  return map;
                  }, {});
                resolve(result);
              })
            })
          })
        },   
    insertInto_user_data: function(user_data, genres){
        	const client = new Client();
      		client.connect().then(() =>{
      			for (track_val in user_data.data){
        				for(genre in genres){
        					if (user_data.data[track_val].song_genres != undefined && user_data.data[track_val].song_genres.includes(genres[genre].toLowerCase())){
        						var sql = 'INSERT INTO public.user_data VALUES ($1, $2, $3, $4, $5, $6, $7, $8)'
        						var current_val = user_data.data[track_val]
        						var params = [current_val.user_id, current_val.event_code,current_val.song_name, current_val.song_artist, current_val.song_popularity, current_val.song_danceability, current_val.song_tempo, current_val.song_genres];
        						client.query(sql, params);
        						break;
        					}
        				}
        				continue
            //has already been added:
            //console.log(fetched_user_data[user_data.data[track_val].song_name])
      			}
      		})
        },
    hasAlreadyInputted : function(user_id){
    const client = new Client();
    return new Promise(function(resolve, reject){
      client.connect().then(() =>{
        var sql = 'SELECT COUNT(user_id) FROM user_data WHERE user_id = $1'
        client.query(sql, [user_id]).then(function(id_count){
          resolve(id_count.rows[0].count)
        })
      })
    })
  }
};
exports.methods = methods;