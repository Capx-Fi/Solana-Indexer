const AWS = require('aws-sdk');
var ddb = new AWS.DynamoDB();
var crypto = require('crypto');
const axios = require('axios');
const yaml = require('js-yaml');

// CREATING AUTH CODE
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

// CREATING HASH ID (PROJID)
function makeHashID(name) {
    const hash = crypto.createHash('sha256').update(name.toLowerCase()).digest('hex');
    return hash
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



// PRE CREATION
async function createAuthCode(username) {
    try {
        // CREATE AUTH CODE
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
async function createNewProject(name, desc, username,authCode) {
    // VERIFY AUTH CODE 
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

    // CREATE PROJ ID FOR NEW PROJECT FROM NAME AND USERNAME
    let projid = makeHashID(username + "/" + name);
    let params2 = {
            TableName: 'indexers',
            Key: {
                'id': {
                    S: projid
                }
            }
        }

    let result = await ddb.getItem(params2).promise();
    if (result.Item !== undefined && result.Item !== null) {
         return {
             "error" : "Project already exists"
         }
    }
    
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
                S: ""
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
            entities : {
                L : []
            }
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
async function verifyProjIdExistence(name) {
    let projid = makeHashID(name)
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
            return {
                "exists" : true
            }
        } else {
            return {
                "exists" : false,
                "projid" : projid
            }
        }
}

async function verifyRepo(user, repo, branch) {
  let link = "https://raw.githubusercontent.com/" + user + "/" + repo + "/" + branch + "/";

  let returnlist = [];
  let result = await axios.get(link + "src/mapping.ts")
  if (result.status != 200) {
    returnlist.push("mapping.ts not found in specified branch or repo is private");
  }
  result = await axios.get(link + "entities.yaml")
  if (result.status != 200) {
    returnlist.push("entities.yaml not found in specified branch or repo is private");
  }
  result = await axios.get(link + "indexer.yaml")
  if (result.status != 200) {
    returnlist.push("indexer.yaml not found in specified branch or repo is private");
  }
  result = await axios.get(link + "package.json")
  if (result.status != 200) {
    returnlist.push("package.json not found in specified branch or repo is private");
  }
  return returnlist;
}

async function parseRepoLink(GHLink , branch = undefined) {
    let user;
    let repo ;
    
  // GETTING USER , REPO , BRANCH
  if (GHLink.startsWith("https://github.com")) {
    GHLink = GHLink.slice(19);
    if (GHLink.endsWith(".git")) {
      GHLink = GHLink.slice(0,GHLink.length-4);
    }
    if (GHLink.split("/").length == 2) {
      [user , repo] = GHLink.split("/");
    } else if (GHLink.split("/").length >= 4) {
      let split = GHLink.split("/");
      user = split[0];
      repo = split[1];
      branch = split.slice(3).join("/");
    } else {
      return ["invalid link"];
    }
  } else if (GHLink.startsWith("git@github.com")) {
    GHLink = GHLink.slice(15);
    GHLink = GHLink.slice(0,GHLink.length-4);
    [user , repo] = GHLink.split("/");
  } else {
    return ["Invalid GitHub link"];
  }

  if (branch == undefined) {
    let result = await axios.get("https://api.github.com/repos/" + user + "/" + repo)
    branch = result.data.default_branch;
  }
  
  return [user , repo , branch];
  
}

// UPDATE and CREATE
async function updateProject(authCode, gh, branch) {
    try {
        // PARSING GITHUB LINK
        let temp = await parseRepoLink(gh,branch)
        if (temp.length < 2) {
            return temp[0]
        }
        let [user , repo , branch] = temp
        
        // VERIFIYING FILES EXISTENCE IN GIVEN REPO
        temp = await verifyRepo(user, repo , branch)
        if (temp.length > 0) {
            return temp
        }
        
        // FETCHING ENTITIES.YAML AND INDEXER.YAML
        let link = "https://raw.githubusercontent.com/" + user + "/" + repo + "/" + branch + "/";
        let result = await axios.get(link + "indexer.yaml")
        let indexerYAML =  yaml.load(result.data)
        result = await axios.get(link + "entities.yaml")
        let entitiesYAML =  yaml.load(result.data)
        
        let name = indexerYAML.solName
        
        // VERIFYING IF USER IS AUTHORIZED
        let projid = makeHashID(name)
        let params1 = {
            TableName: 'indexers',
            Key: {
                'id': {
                    S: projid
                }
            }
        }

        let indexer = await ddb.getItem(params1).promise();
        
        if (indexer.Item == undefined) {
            return "Project is not Initialized properly"
        }

        if (indexer.Item.authCode.S !== authCode) {
            return ("Invalid auth code");
        }
        
        // DELETE OLD ENTITIES IF ANY
        let oldEntityList = indexer.Item.entities.L
        for (let index = 0; index < oldEntityList.length; index++) {
            const element = oldEntityList[index];
            let params = {
                "TableName": projid + "_" + element,
            }
            await ddb.deleteTable(params).promise();
            await ddb.waitFor("tableNotExists",params).promise()
        }
        
        // CREATE NEW TABLES
        let entityList = entitiesYAML["entities"];
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
        
        // CREATE DOCKER CONTAINER
        // CALL EC2 FUNCTION WITH USER , REPO , BRANCH AND PROJID
        
        // UPDATE INDEXER TABLE ACCORDINGLY
        let params = {
            "TableName": "indexers",
            "Key": {
                "id": {
                    "S": projid
                }
            },
            "UpdateExpression": "set entities = :e",
            "ExpressionAttributeValues": {
                ":e": {
                    "L": entityList.map(x => x.name)
                }
            }
        }

        await ddb.updateItem(params).promise();
        
    } catch (error) {
        
    }
}

// DELETE
async function deleteProject(name ,authCode ) {
    let projid = makeHashID(name)
    
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

    let entityList = indexer.Item.entities.L;
    for (let index = 0; index < entityList.length; index++) {
        const element = entityList[index];
        let params = {
            "TableName": projid + "_" + element,
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
    console.log(event)
    let body = JSON.parse(event["body"])
    let returnobj;
    switch (event["path"]) {
        case "/createauthcode" :
            returnobj = await createAuthCode(body.username)
            break;
        case "/createnewproject":
            returnobj = await createNewProject(body.name,body.gh,body.desc,body.username,body.authCode)
            break;
        case "/updateproject":
            returnobj = await updateProject(body.authCode, body.gh, body.branch)
            break;
        case "/deleteproject" :
            returnobj = await deleteProject(body.name,body.authCode)
            break;
        case "/verifyproject" :
            returnobj = await verifyProjIdExistence(body.name)
            break;
    }
    const response = {
        statusCode: 200,
        body: JSON.stringify(returnobj),
    };
    return response;
};
