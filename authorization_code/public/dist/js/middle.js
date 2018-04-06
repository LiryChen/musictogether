function refresh_user_data() {
	var settings = {
	  "async": true,
	  "crossDomain": true,
	  "url": "http://localhost:8888/db",
	  "method": "GET",
	  "headers": {
	    "Cache-Control": "no-cache",
	    "Postman-Token": "3d49e990-5beb-428c-8643-4f2aa6305bb9"
	   }
	}
	$(document).ready(function() {
		$.ajax(settings).done(function (response) {
			
		  $('#example').DataTable({
	        "ajax": "db",
	        "columns": [
		            { "data": "song_name" },
		            { "data": "song_artists" },
		            { "data": "count" },
		            { "data": "song_tempo" },
		            { "data": "song_popularity" },
		            { "data": "song_danceability" }
	        	]
	    	});

		});
	});              
}





