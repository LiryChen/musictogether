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
		  table = $('#example').DataTable({
	        "ajax": "db",
	        "columns": [
		            { "data": "Title" },
		            { "data": "Artist" },
		            { "data": "Count" },
		            { "data": "Tempo" },
		            { "data": "Popularity" },
		            { "data": "Danceability" }
	        	]
	    	});
		});
	});              
}





