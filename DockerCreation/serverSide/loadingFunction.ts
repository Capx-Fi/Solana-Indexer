// FUNCTION TO LOAD AN ENTITY FROM PRIMARY KEY

const AWS = require('aws-sdk');
AWS.config.update({region: 'ap-southeast-2'});
var ddb = new AWS.DynamoDB({apiVersion: '2012-08-10'});


export async function loader(entityName : string,primId : any, primName : string) : Promise<null|object> {
    let params;
    console.log(primId);
    console.log(primName);
    console.log(typeof primId)
    
    
    
    if (typeof primId === 'number') {
        params = {
            "TableName": process.env.PROJECT_ID + "_" + entityName,
            "Key": {
                [primName] : {
                    N : primId.toString()
                }
            }
        }
    } else if (typeof primId === 'boolean') {
        console.log(primId.toString());
        params = {
            "TableName": process.env.PROJECT_ID + "_" + entityName,
            "Key": {
                [primName] : {
                    BOOL : primId
                }
            }
        } } else  {
        params = {
            "TableName": process.env.PROJECT_ID + "_" + entityName,
            "Key": {
                [primName] : {
                    S : primId.toString()
                }
            }
        }
    }

    console.log(params);
    
    

    let data = await ddb.getItem(params).promise();
    console.log("load completed");
    
    if (data.Item) {
        return data.Item;
    } else {
        return null;
    }
}
