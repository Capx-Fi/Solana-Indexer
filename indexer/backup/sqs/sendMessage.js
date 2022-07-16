const AWS = require('aws-sdk');
// Set the region 
AWS.config.update({region: 'us-east-1'});

// Create an SQS service object
const sqs = new AWS.SQS({apiVersion: '2012-11-05'});

module.exports = async(msg) => {
    var params = {
       DelaySeconds: 0,
       MessageAttributes: {
        "Indexer": {
          DataType: "String",
          StringValue: "Backup Indexer"
        }
      },
       MessageBody: JSON.stringify(msg),
       QueueUrl: "https://sqs.us-east-1.amazonaws.com/296324153710/testQueue"
     }
    let status = false;
    try {
        sqs.sendMessage(params, async function(err, data) {
            if (err) {
                status = false;
                console.log("SQS Error :", err);
            } else {
                status = true;
                console.log("SQS Success :", data.MessageId);
            }
        });
    } catch (err) {
        console.log("Error SendMessage :", err);
    }
    return status;
}