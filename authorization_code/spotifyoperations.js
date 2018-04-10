var express = require('express');
var request = require('request');
var querystring = require('querystring');
var cookieParser = require('cookie-parser');
var promise = require('promise')
var bodyparser = require('body-parser');
var {Client} = require('pg');
var path = require('path')

var methods = {
  get_host_id: function(global_access_token){
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
  },
  get_user_music_data: function(user_id, access_token, eventcode) {
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
        },
  get_track_features: function(host_data, global_access_token){
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
  },
  get_user_id: function(access_token){
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
        },   
        get_user_music_data: function(user_id, access_token, eventcode) {
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
        },
        get_track_features: function(user_data, access_token){
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
        },
        get_artist_genres: function(user_data, access_token){
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
        },
        format_playlist: function(playlists){
          playlists = playlists.data
          var formatted_data = []
          for (playlist in playlists){
            formatted_data.push(playlists[playlist].playlist_name +";"+playlists[playlist].playlist_id + ";" + playlists[playlist].playlist_owner)
          }
          return formatted_data
        },
        get_hosts_songs: function(host_id, host_playlist, global_access_token, event_code){
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
            "event_code": event_code,
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
};
exports.methods = methods;