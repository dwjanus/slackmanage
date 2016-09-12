
'use strict';

const _ = require('lodash');
const config = require('../config');
const Samanage = require('../lib/samanage');
const https = require('https');
const util = require('util');

const msgDefaults = {
  response_type: 'in_channel',
  username: 'incident',
  icon_emoji: config('ICON_EMOJI')
};

const handler = (payload, res) => {

  console.log('PAYLOAD:\n' + util.inspect(payload) + '\n');
  var str = payload.text;
  var cmd = str.split(/(@|#)/)[1];
  var number = str.split(/(@|#)/)[2];
  var url = payload.response_url;
  
  console.log('STR: ' + str + '\nCMD: ' + cmd + '\nNUMBER: ' + number + '\n');

  var options = {
    host: 'api.samanage.com',
    path: '/incidents/' + number + '.json',
    method: 'GET',
    headers: { 'accept' : 'application/vnd.samanage.v1.3+json', 'Content-Type' : 'application/json', 'Cache-Control' : 'no-store' },
    auth: config('API_USER') + ':' + config('API_PASS')
  };

  var pre_text = 'with id: ';
  if (cmd === '@') {
    let pre = _.defaults({
      channel: payload.channel_name,
      text: 'Finding Incident ' + pre_text + number + '...'
    }, msgDefaults);

    res.set('Content-Type', 'application/json');
    res.send(pre);

    Samanage.incident(options, (err, incident) => {
      if (err) console.log(err);

      var attachments = [
        {
          fallback: `${incident.fallback}`,
          color: `${incident.color}`,
          pretext: `Ticket: ${incident.number}`, 
          author_name: `Requested by: ${incident.requester} -- ${incident.requester_email}\n`,
          author_icon: `${incident.requester_icon}`,
          title: `${incident.title}\n`,
          title_link: `${incident.title_link}`,
          text: `${incident.description}\n\n`,
          image_url: `${incident.image_url}`,
          fields: [
            {
              title: 'Assigned To',
              value: `${incident.assignee}`,
              short: true
            },
            {
              title: 'State',
              value: `${incident.state}`,
              short: true
            },
            {
              title: 'Priority',
              value: `${incident.priority}`,
              short: true
            }
          ],
        },
        {
          footer: 'due on: ',
          ts: `${incident.ts}`,
          mrkdown_in: ['text', 'pretext'],
        }
      ];  

      if (incident.comments_num > 0) {
        attachments.push({
          fallback: "No Comments Attached",
          callback_id: "comments_btn",
          color: "#3AA3E3",
          attachment_type: "default",
          actions: [
            {
                name: "View",
                text: "View Comments",
                type: "button",
                value: "view"
            }
          ]
        });
        // make response url = action url ?

      } else {
        attachments.push({text: "No Comments Attached"});
      }

      let msg = _.defaults({
        channel: payload.channel_name,
        attachments: attachments
      }, msgDefaults);

      var post_options = {
         host: 'hooks.slack.com',
         path: '/' + url.split('.com/')[1],
         method: 'POST',
         headers: { 'Content-Type' : 'application/json' },
         port: 443
      };
      
      var request = https.request(post_options, function (response) {
        response.setEncoding('utf8');
      });

      request.on('error', function (e) {
        console.log('problem with request: ' + e.message);
      });
      request.write(JSON.stringify(msg));
      request.end();

      return;
    });

  } else {
    pre_text = 'with ticket number: ';
    let pre = _.defaults({
      channel: payload.channel_name,
      text: 'Finding Incident ' + pre_text + number + '...'
    }, msgDefaults);

    res.set('Content-Type', 'application/json');
    res.send(pre);

    Samanage.find_incident(number, (err, incident_number, incident_id) => {
      if(err) console.log(err);
      options.path = '/incidents/' + incident_id + '.json';

      Samanage.incident(options, (err, incident) => {
        if (err) console.log(err);

        var attachments = [
          {
            fallback: `${incident.fallback}`,
            color: `${incident.color}`,
            pretext: `Ticket: ${incident.number}`, 
            author_name: `Requested by: ${incident.requester} -- ${incident.requester_email}\n`,
            author_icon: `${incident.requester_icon}`,
            title: `${incident.title}\n`,
            title_link: `${incident.title_link}`,
            text: `${incident.description}\n\n`,
            image_url: `${incident.image_url}`,
            fields: [
              {
                title: 'Assigned To',
                value: `${incident.assignee}`,
                short: true
              },
              {
                title: 'State',
                value: `${incident.state}`,
                short: true
              },
              {
                title: 'Priority',
                value: `${incident.priority}`,
                short: true
              }
            ],
          },
          {
            footer: 'due on: ',
            ts: `${incident.ts}`,
            mrkdown_in: ['text', 'pretext'],
          }
        ];  

        if (incident.comments_num > 0) {
          attachments.push({
            fallback: "Would you like to view the comments?",
            callback_id: "comments_btn",
            color: "#3AA3E3",
            attachment_type: "default",
            actions: [
              {
                name: "View",
                text: "View Comments",
                type: "button",
                value: "view"
              }
            ]
          });
        } else {
          attachments.push({text: "No Comments Attached"});
        } 

        let msg = _.defaults({
          channel: payload.channel_name,
          attachments: attachments,
          response_url: url.response_url
        }, msgDefaults);

        var post_options = {
           host: 'hooks.slack.com',
           path: '/' + url.split('.com/')[1],
           method: 'POST',
           headers: { 'Content-Type' : 'application/json' },
           port: 443
        };
        
        var request = https.request(post_options, function (response) {
          response.setEncoding('utf8');
        });

        request.on('error', function (e) {
          console.log('problem with request: ' + e.message);
        });
        request.write(JSON.stringify(msg));
        request.end();

        return;
      });
    });
  }
};

module.exports = { pattern: /(@|#)+[0-9]/ig, handler: handler };
