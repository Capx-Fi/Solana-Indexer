// MAIN SERVER TO MANAGE ALL INSTANCE CREATION DELETION AND UPDATING

const AWS = require('aws-sdk');
AWS.config.update({region: 'US-EAST-1'});
var ddb = new AWS.DynamoDB();

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

interface parsedEvent {
    name: string;
    params: [
        {
            "name": string;
            "type": string;
        }
    ];
    handler: string;
}


function parseEventString(params : {event : string; handler : string;}) {
    const event = params.event;
    const handler = params.handler;
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

let mapper : Map<string,string> = new Map<string,string> ([
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

interface yamlInterface {
    indexer : string;
    schema : {
        file: string;
    };
    dataSources : [
        {
            kind : string;
            name : string;
            network : string;
            source : {
                programId : string;
                idl : string;
            };
            mapping : {
                kind : string;
                entities : [
                    string
                ];
                idls : [
                    {
                        name : string;
                        file : string;
                    }
                ];
                file : string;
                eventHandlers : [
                    {
                        event : string;
                        handler : string;
                    }
                ]
            }
        }
    ],
    entities : [
        {
            name : string;
            params : [
                {
                    name : string;
                    type : string;
                    primary : boolean;
                }
            ]
        }
    ]
}


// PRE CREATION
export async function createAuthCode(username : string) {
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
export async function createNewProject(name : string , gh : string , desc : string, username : string, authCode : string) {
    let params1 = {
        tableName : 'authCodes',
        key: {
            username: {S: username}
        },
        attributeValues: {
            authCode: {S: authCode}
        }
    }
    let authCodeFromDb = await ddb.getItem(params1).promise();
    if (authCodeFromDb.Item.authCode.s === authCode) {
        throw new Error("User not Authorized");
    }

    let projid = makeid();
    let params = {
        TableName: 'indexers',
        Item: {
            'id': {
                S: projid
            },
            "authCode" : {
                S: authCodeFromDb.Item.authCode.S
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

// CREATION
export async function createProject(indexerYAML : object,projid : string,authCode : string) {
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

        let indexerYAMLParsed = indexerYAML as yamlInterface;

        let entityList = indexerYAMLParsed["entities"];

        for (let index = 0; index < entityList.length; index++) {
            const element = entityList[index];
            let params = {
                "TableName": projid + "_" + element["name"],
                "AttributeDefinitions": element.params.map(param => {
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
                })
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
            "UpdateExpression": "set indexer = :i, status = :s, error = :e",
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
            }
        }

        await ddb.updateItem(params).promise();
    } catch (error) {
        let params = {
            "TableName": "indexers",
            "Key": {
                "projid": {
                    "S": projid
                }
            },
            "UpdateExpression": "set status = :s, error = :e",
            "ExpressionAttributeValues": {
                ":s": {
                    "S": "Error"
                },
                ":e": {
                    "S": error.message
                }
            }
        }

        await ddb.updateItem(params).promise();
    }
}

// UPDATE
export async function updateProject(projid : string,newIndexerYAML : object,authCode : string) {
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

        let indexerYAMLParsed = newIndexerYAML as yamlInterface;
        let entityList = indexerYAMLParsed["entities"];

        let oldIndexerYAMLResponse = await ddb.getItem({
            "TableName": "indexers",
            "Key": {
                "projid": {
                    "S": projid
                }
            }
        });

        let oldIndexerYAML = JSON.parse(oldIndexerYAMLResponse.Item.indexer.S) as yamlInterface;

        let oldEntityList = oldIndexerYAML["entities"];
        for (let index = 0; index < oldEntityList.length; index++) {
            const element = oldEntityList[index];
            let params = {
                "TableName": projid + "_" + element["name"],
            }
            await ddb.deleteTable(params).promise();
        }

        for (let index = 0; index < entityList.length; index++) {
            const element = entityList[index];
            let params = {
                "TableName": projid + "_" + element["name"],
                "AttributeDefinitions": element.params.map(param => {
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
                })
            }
            
            await ddb.createTable(params).promise();
        }

        let indexerYAMLString = JSON.stringify(indexerYAMLParsed);
        let params = {
            "TableName": "indexers",
            "Key": {
                "projid": {
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
                "projid": {
                    "S": projid
                }
            },
            "UpdateExpression": "set status = :s, error = :e",
            "ExpressionAttributeValues": {
                ":s": {
                    "S": "Error"
                },
                ":e": {
                    "S": error.message
                }
            }
        }
        
        await ddb.updateItem(params).promise();
    }
}

// DELETE
export async function deleteProject(projid : string,authCode : string) {
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

    let indexerYAMLResponse = await ddb.getItem({
        "TableName": "indexers",
        "Key": {
            "projid": {
                "S": projid
            }
        }
    });

    let indexerYAML = JSON.parse(indexerYAMLResponse.Item.indexer.S) as yamlInterface;

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
            "projid": {
                "S": projid
            }
        }
    }

    await ddb.deleteItem(params).promise();
}

// gqAkydaLyJ5rZjnl9bZYCrl811bGe4MGpcuHZii1j4Je0Xr2ClRKCzmn4RdqUSvK

// qDfXHmD44H6RUBaOFnEJ6MGuL5LYAhLfWrUKmXaqphBdkxqs1twsY97LtYBo1Bp5