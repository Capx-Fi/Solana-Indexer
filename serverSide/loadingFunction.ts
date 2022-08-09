// FUNCTION TO LOAD AN ENTITY FROM PRIMARY KEY

const AWS = require('aws-sdk');
AWS.config.update({region: 'US-EAST-1'});
var ddb = new AWS.DynamoDB();


export async function loader(entityName : string,primId : any) : Promise<null|object> {
    let params;
    if (typeof primId === 'number') {
        params = {
            "TableName": process.env.PROJECT_ID + "_" + entityName,
            "Key": {
                "primaryId": {
                    N : primId
                }
            }
        }
    } else {
        params = {
            "TableName": process.env.PROJECT_ID + "_" + entityName,
            "Key": {
                "primaryId": {
                    S : primId.toString()
                }
            }
        }
    }

    let data = await ddb.getItem(params).promise();

    if (data.Item) {
        return data.Item;
    } else {
        return null;
    }
}
