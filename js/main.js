import $ from 'jquery';
import chrono from 'chrono-node';
import URLParser from 'url-parse';

import fetchDistanceMatrix from './distance-service';
import RoutePlanner from './route-planner';
import pdfGenerator from './pdfGenerator';

// ########## Google Maps Callback ##########
window.initMap = function() {
    new google.maps.places.Autocomplete(document.getElementById('initial_location'));
    new google.maps.places.Autocomplete(document.getElementById('final_location'));
    autofillFromURL();
}

// ########## UI THINGS ##########
$(document).ready(function() {
    $('select').material_select();
    $('.modal').modal();
    $('#share_btn').click(show_share_url);
});

$('#location_count').change(function(){
    var location_count = $('#location_count').val();
    generate_location_inputs(location_count);
});

function generate_location_inputs(count) {
    var out = "";
    var previous_locations = [];
    for(var i=0;i<count;i++) {
        if ($('#pub'+i)) {
            previous_locations.push($('#pub'+i).val());
        }
        out += '<div class="row">';
        out += '   <div class="input-field col s12">';
        out += '        <input placeholder="" id="pub'+i+'" type="text" class="validate">';
        out += '        <label for="pub'+i+'">Pub '+(i+1)+' location</label>';
        out += '   </div>';
        out += '</div>';
    }
    $("#locations").html(out);
    $('select').material_select();
    for(var i=0;i<count;i++) {
        new google.maps.places.Autocomplete(document.getElementById('pub'+i));
        // Solves a bug where the input label would overlap the already present content
        $('#pub'+i).focus();
        $('#pub'+i).val(previous_locations[i]);
    }
    $('#pub0').focus();
}

function show_wait_message(callback) {
    $("#generate-btn").fadeOut(300, function() {
        $("#wait-message").hide().fadeIn(300, callback);
    });
}

function change_wait_message(newMessage) {
    $("#wait-message-contents").text(newMessage);
}

function hide_wait_message() {
    $("#wait-message").fadeOut(300, function() {
        $("#generate-btn").hide().fadeIn(300);
    });
}

function show_share_url() {
    if (!check_inputs()) {
        return;
    }
    $('#share_url').val(generateShareURL());
    $('#share_url_container').fadeIn(function() {
        $('#share_url').focus();
        $('#share_url').select();
    });
}

// ########## SHARING ##########
function generateShareURL() {
    var url = new URLParser(location.href);

    // Fetching the initial and final locations
    var initialLocation = get_initial_location();
    var finalLocation = get_final_location();
    var parameters = {
        initial: initialLocation,
        final: finalLocation
    }

    // Converting the pub locations in the right array format
    var pubLocations = get_pub_locations();
    for(var i = 0; i < pubLocations.length; i++) {
        parameters['pub'+i] = pubLocations[i];
    }

    // Fetching start time and end time
    parameters['start'] = get_start_time_raw();
    parameters['end'] = get_end_time_raw();

    // Fetching, guess what, team count
    parameters['team'] = get_team_count();

    // Generating the url
    url.set("query", parameters);
    return url.toString();
}

function autofillFromURL() {
    var url = new URLParser(location.href, true);
    var parameters = url.query;

    if (parameters.initial) {
        set_initial_location(parameters.initial);
    }
    if (parameters.final) {
        set_final_location(parameters.final);
    }
    if (parameters.team) {
        set_team_count(parameters.team);
    }
    if (parameters.start) {
        set_start_time(parameters.start);
    }
    if (parameters.end) {
        set_end_time(parameters.end);
    }

    var locations = [];
    var i = 0;
    while (parameters['pub'+i] !== undefined) {
        locations.push(parameters['pub'+i]);
        i++;
    }
    set_pub_locations(locations);
}

// ########## GENERATE THE REPORT ##########
$("#generate-btn").click(function(){
    generate_report();
});

function generate_report() {
    if (!check_inputs()) {
        return;
    }
    var num_teams = get_team_count();
    var locations = get_all_locations();
    var time = get_dates();

    show_wait_message(function() {
        var planner = new RoutePlanner(num_teams, locations, time.start, time.end, fetchDistanceMatrix);
        planner.generateRoutes(change_wait_message).then(parse_routes, route_exception);
    });
}

function route_exception(e) {
    $('#error-modal-description').text(e.message);
    $('#error-modal').modal({ complete: hide_wait_message });
    $('#error-modal').modal('open');
}

function parse_routes(routes) {
    change_wait_message("Generating PDF...");
    var locations = get_all_locations();
    var startTime = get_start_time();
    var parsed_data = [];
    var in_bar = false;
    var start_index = -1;
    var end_index = -1;
    var current_location_id = -1;
    routes.forEach(function(team, i){
        parsed_data[i] = [];
        in_bar = false;
        start_index = -1;
        end_index = -1;
        team.forEach(function(timeslot, j){
            if ((timeslot !== current_location_id && in_bar) || j === team.length - 1) {
                end_index = j-1;
                parsed_data[i].push({startTime: new Date(startTime.getTime() + (start_index * 300000)), endTime: new Date(startTime.getTime() + ((end_index + 1) * 300000)), spot: locations[current_location_id]});
                in_bar = false;
            }
            if (timeslot !== undefined && !in_bar) {
                in_bar = true;
                start_index = j;
                current_location_id = timeslot;
            }
        });
    });
    pdfGenerator(parsed_data);
}

// ########## GETTERS ##########
function get_all_locations() {
    var pub_locations = get_pub_locations();
    var initial_location = get_initial_location();
    var final_location = get_final_location();
    return _.flatten([initial_location, pub_locations, final_location]);
}

function get_pub_locations() {
    var locations = [];
    var i = 0;
    var element;
    while($('#pub'+i).length !== 0) {
        locations.push($('#pub'+i).val());
        i++;
    }
    return locations;
}

function set_pub_locations(locations) {
    $("#location_count").val(locations.length);
    generate_location_inputs(locations.length);
    var i = 0;
    while($('#pub'+i).length !== 0 && i < locations.length) {
        $('#pub'+i).val(locations[i]);
        i++;
    }
}

function get_initial_location() {
    return $('#initial_location').val();
}

function set_initial_location(location) {
    $('#initial_location').val(location);
}

function get_final_location() {
    return $('#final_location').val();
}

function set_final_location(location) {
    $('#final_location').val(location);
}

function get_start_time() {
    return chrono.parse($('#start_time').val())[0].start.date();
}

function get_start_time_raw() {
    return $('#start_time').val();
}

function set_start_time(time) {
    $('#start_time').val(time);
}

function get_end_time() {
    return chrono.parse($('#end_time').val())[0].start.date();
}

function get_end_time_raw() {
    return $('#end_time').val();
}

function set_end_time(time) {
    $('#end_time').val(time);
}

function get_team_count() {
    return parseInt($('#team_count').val(), 10);
}

function set_team_count(count) {
    $('#team_count').val(count);
}

function get_dates() {
  var startTime = get_start_time();
  var endTime = get_end_time();

  return {
    start: startTime,
    end:endTime
  }
}

// ########## DATA CHECKING ##########
function check_inputs() {
    if (!get_initial_location()) {
        alert("The initial location is empty.");
        return false;
    }
    if (!get_final_location()) {
        alert("The final location is empty.");
        return false;
    }
    var locations = get_pub_locations();
    if (locations.length < 1) {
        alert("There must be at least of pub location.");
        return false;
    }
    for (var location of locations) {
        if (!location) {
            alert("There is an empty pub location.");
            return false;
        }
    }
    if (!parseInt($('#team_count').val(), 10)) {
        alert("The number of team is not a valid integer.");
        return false;
    }
    return check_dates();
}

function check_dates() {
    var time = get_dates();
    if (!time.start) {
        alert("The start time is empty or invalid.");
        return false;
    }
    if (!time.end) {
        alert("The end time is empty or invalid.");
        return false;
    }
    if (time.start > time.end) {
        alert("The end time must be after the start time.");
        return false;
    }
    return true;
}
