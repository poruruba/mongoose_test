'use strict';

const HELPER_BASE = process.env.HELPER_BASE || '../../helpers/';
const Response = require(HELPER_BASE + 'response');
const Redirect = require(HELPER_BASE + 'redirect');

const fetch = require('node-fetch');

exports.handler = async (event, context, callback) => {
	var body = JSON.parse(event.body);
	console.log(body);

  const headers = { "Content-Type" : "application/json" };
  
  return fetch(body.target_url, {
      method : 'POST',
      body : JSON.stringify(body),
      headers: headers
  })
  .then((response) => {
      if( !response.ok )
          throw 'response is not ok.';
      return response.json();
  })
  .then(json =>{
    console.log(json);
    return new Response(json);
  });
};
