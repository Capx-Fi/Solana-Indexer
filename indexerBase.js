const AWS = require('aws-sdk');
var ddb = new AWS.DynamoDB();
var crypto = require('crypto');

function makeid(length = 64) {
    var result           = '';
    var characters       = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    var charactersLength = characters.length;
    for ( var i = 0; i < length; i++ ) {
      result += characters.charAt(Math.floor(Math.random() * 
 charactersLength));
   }
   return result;
}

function makeHashID(name , authcode) {
    const hash = crypto.createHash('sha256').update(name+authcode).digest('hex');
    return hash
}

// interface parsedEvent {
//     name: string;
//     params: [
//         {
//             "name": string;
//             "type": string;
//         }
//     ];
//     handler: string;
// }


function parseEventString(event, handler) {
    const eventName = event.split("(")[0];
    const eventParams = event.split("(")[1].split(")")[0];
    const eventParamsArray = eventParams.split(",");
    const eventParamsArrayParsed = eventParamsArray.map(param => {
        const paramName = param.split(" ")[0];
        const paramType = param.split(" ")[param.split(" ").length - 1];
        return {
            name: paramName,
            type: paramType
        }
    }).filter(param => param.name !== "this");
    return {
        name: eventName,
        params: eventParamsArrayParsed,
        handler: handler
    }
    
    
}

let mapper = new Map ([
    ["publicKey" , "S"],
    ["bool" , "S"],
    ["string" , "S"],
    ["number","N"],
    ["u8" , "N"],
    ["i8" , "N"],
    ["u16" , "N"],
    ["i16" , "N"],
    ["u32" , "N"],
    ["i32" , "N"],
    ["f32" , "N"],
    ["f64" , "N"],
    ["u64" , "N"],
    ["i64" , "N"],
    ["u128" , "N"],
    ["i128" , "N"],
])

// interface yamlInterface {
//     indexer : string;
//     schema : {
//         file: string;
//     };
//     dataSources : [
//         {
//             kind : string;
//             name : string;
//             network : string;
//             source : {
//                 programId : string;
//                 idl : string;
//             };
//             mapping : {
//                 kind : string;
//                 entities : [
//                     string
//                 ];
//                 idls : [
//                     {
//                         name : string;
//                         file : string;
//                     }
//                 ];
//                 file : string;
//                 eventHandlers : [
//                     {
//                         event : string;
//                         handler : string;
//                     }
//                 ]
//             }
//         }
//     ],
//     entities : [
//         {
//             name : string;
//             params : [
//                 {
//                     name : string;
//                     type : string;
//                     primary : boolean;
//                 }
//             ]
//         }
//     ]
// }


// PRE CREATION
async function createAuthCode(username) {
    try {
        const authCode = makeid();
    const params = {
        TableName: 'authCodes',
        Item: {
            username: {S: username},
            authCode: {S: authCode}
        }
    };
    await ddb.putItem(params).promise();
    return authCode;
    } catch (error) {
        return error.message;
    }
}

//PRE CREATION
async function createNewProject(name , gh , desc , username,authCode) {
    let params1 = {
        TableName : 'authCodes',
        Key: {
            username : {S: username}
        }
    }
    
    let authCodeFromDb = await ddb.getItem(params1).promise();
    if (authCodeFromDb.Item.authCode.S !== authCode) {
        throw new Error("User not Authorized");
    }

    let projid = makeHashID(name,authCode);
    let params = {
        TableName: 'indexers',
        Item: {
            'id': {
                S: projid
            },
            "authCode" : {
                S: authCode
            },
            'name': {
                S: name
            },
            'description': {
                S: desc
            },
            'github': {
                S: gh
            },
            'created': {
                S: new Date().toISOString()
            },
            "status": {
                S: "created"
            },
            initCommand: {
                S: ""
            },
            buildCommand: {
                S: ""
            },
            deployCommand: {
                S: ""
            },
            error : {
                S: ""
            },
            indexer: {
                S: ""
            },
        }
    };

    await ddb.putItem(params).promise();

    return {
        id: projid,
        initCommand : "",
        buildCommand : "",
        deployCommand : "",
    }
}

// Verify if projid exists
async function verifyProjIdExistence(projid) {
    let params1 = {
            TableName: 'indexers',
            Key: {
                'id': {
                    S: projid
                }
            }
        }

        let indexer = await ddb.getItem(params1).promise();
        
        if (indexer.Item != null) {
            return true
        } else {
            return false
        }
}

// CREATION
async function createProject(indexerYAML,projid,authCode) {
    try {
        let params1 = {
            TableName: 'indexers',
            Key: {
                'id': {
                    S: projid
                }
            }
        }

        let indexer = await ddb.getItem(params1).promise();

        if (indexer.Item.authCode.S !== authCode) {
            return {
                "indexer" : indexer,
                "authCode" : authCode
            };
        }

        let indexerYAMLParsed = indexerYAML;

        let entityList = indexerYAMLParsed["entities"];

        for (let index = 0; index < entityList.length; index++) {
            const element = entityList[index];
            let params = {
                "TableName": projid + "_" + element["name"],
                "AttributeDefinitions": element.params.filter(param => param.primary).map(param => {
                    return {
                        AttributeName: param.name,
                        AttributeType: mapper.get(param.type)
                    }
                }),
                "KeySchema": element.params.filter(param => param.primary).map(param => {
                    return {
                        AttributeName: param.name,
                        KeyType: "HASH"
                    }
                }),
                ProvisionedThroughput: {
        ReadCapacityUnits: 10,
        WriteCapacityUnits: 10
    }
            }
            
            await ddb.createTable(params).promise();
        }

        let indexerYAMLString = JSON.stringify(indexerYAMLParsed);
        let params = {
            "TableName": "indexers",
            "Key": {
                "id": {
                    "S": projid
                }
            },
            "UpdateExpression": "SET #in = :i , #st = :s , #er = :e",
            "ExpressionAttributeValues": {
                ":i": {
                    "S": indexerYAMLString
                },
                ":s": {
                    "S": "Running"
                },
                ":e": {
                    "S": ""
                }
            },
            ExpressionAttributeNames : {
                "#in" : "indexer",
                "#st" : "status",
                "#er" : "error"
            }
        }

        await ddb.updateItem(params).promise();
    } catch (error) {
        let params = {
            "TableName": "indexers",
            "Key": {
                "id": {
                    "S": projid
                }
            },
            "UpdateExpression": "SET #st = :s, #er = :e",
            "ExpressionAttributeValues": {
                ":s": {
                    "S": "Error"
                },
                ":e": {
                    "S": error.message
                }
            },
            ExpressionAttributeNames : {
                "#st" : "status",
                "#er" : "error"
            }
            
        }

        await ddb.updateItem(params).promise();
        
        return error.message
    }
}

// UPDATE
async function updateProject(projid ,newIndexerYAML,authCode) {
    try {
        let params1 = {
            TableName: 'indexers',
            Key: {
                'id': {
                    S: projid
                }
            }
        }

        let indexer = await ddb.getItem(params1).promise();

        if (indexer.Item.authCode.S !== authCode) {
            return ("Invalid auth code");
        }

        let indexerYAMLParsed = newIndexerYAML;
        let entityList = indexerYAMLParsed["entities"];

        let oldIndexerYAMLResponse = await ddb.getItem({
            "TableName": "indexers",
            "Key": {
                "id": {
                    "S": projid
                }
            }
        }).promise();

        let oldIndexerYAML = JSON.parse(oldIndexerYAMLResponse.Item.indexer.S);

        let oldEntityList = oldIndexerYAML["entities"];
        for (let index = 0; index < oldEntityList.length; index++) {
            const element = oldEntityList[index];
            let params = {
                "TableName": projid + "_" + element["name"],
            }
            await ddb.deleteTable(params).promise();
            await ddb.waitFor("tableNotExists",params).promise()
        }

        for (let index = 0; index < entityList.length; index++) {
            const element = entityList[index];
            let params = {
                "TableName": projid + "_" + element["name"],
                "AttributeDefinitions": element.params.filter(param => param.primary).map(param => {
                    return {
                        AttributeName: param.name,
                        AttributeType: mapper.get(param.type)
                    }
                }),
                "KeySchema": element.params.filter(param => param.primary).map(param => {
                    return {
                        AttributeName: param.name,
                        KeyType: "HASH"
                    }
                }),
                ProvisionedThroughput: {
        ReadCapacityUnits: 10,
        WriteCapacityUnits: 10
    }
            }
            
            await ddb.createTable(params).promise();
        }

        let indexerYAMLString = JSON.stringify(indexerYAMLParsed);
        let params = {
            "TableName": "indexers",
            "Key": {
                "id": {
                    "S": projid
                }
            },
            "UpdateExpression": "set indexer = :i",
            "ExpressionAttributeValues": {
                ":i": {
                    "S": indexerYAMLString
                }
            }
        }

        await ddb.updateItem(params).promise();
    } catch (error) {
        let params = {
            "TableName": "indexers",
            "Key": {
                "id": {
                    "S": projid
                }
            },
            "UpdateExpression": "SET #st = :s, #er = :e",
            "ExpressionAttributeValues": {
                ":s": {
                    "S": "Error"
                },
                ":e": {
                    "S": error.message
                }
            },
            ExpressionAttributeNames : {
                "#st" : "status",
                "#er" : "error"
            }
            
        }

        await ddb.updateItem(params).promise();
        
        return error.message
    }
}

// DELETE
async function deleteProject(projid ,authCode ) {
    let params1 = {
        TableName: 'indexers',
        Key: {
            'id': {
                S: projid
            }
        }
    }

    let indexer = await ddb.getItem(params1).promise();

    if (indexer.Item.authCode.S !== authCode) {
        return ("Invalid auth code");
    }

    let indexerYAML = JSON.parse(indexer.Item.indexer.S) ;

    let entityList = indexerYAML["entities"];
    for (let index = 0; index < entityList.length; index++) {
        const element = entityList[index];
        let params = {
            "TableName": projid + "_" + element["name"],
        }
        await ddb.deleteTable(params).promise();
    }

    let params = {
        "TableName": "indexers",
        "Key": {
            "id": {
                "S": projid
            }
        }
    }

    await ddb.deleteItem(params).promise();
}

exports.handler = async (event) => {
    let body = JSON.parse(event["body"])
    let returnobj;
    switch (event["path"]) {
        case "/createauthcode" :
            returnobj = await createAuthCode(body.username)
            break;
        case "/createnewproject":
            returnobj = await createNewProject(body.name,body.gh,body.desc,body.username,body.authCode)
            break;
        case "/createproject" :
            returnobj = await createProject(JSON.parse(body.indexerYAML),body.projid,body.authCode)
            break;
        case "/updateproject":
            returnobj = await updateProject(body.projid,JSON.parse(body.newIndexerYAML) ,body.authCode)
            break;
        case "/deleteproject" :
            returnobj = await deleteProject(body.projid,body.authCode)
            break;
    }
    const response = {
        statusCode: 200,
        body: JSON.stringify(returnobj),
    };
    return response;
};
