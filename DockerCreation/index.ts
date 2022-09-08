import express, { Request, Response, NextFunction } from 'express';
import * as fs from 'fs';
var bodyParser = require('body-parser')
var execSync = require('child_process').execSync;
let yaml = require("js-yaml");
const axios = require('axios');


const app = express();
const port = 3000;
app.use(bodyParser.json())

async function verifyContainer(projid : string) {
  let exists = execSync("sudo docker container ls -a -f name=^/" + projid + "$").toString()
  if (exists.trim().split("\n").length >1) {
    let temp = exists.split("\n")[1].split("  ").map((x : string) => x.trim()).filter((x : string) => x != "")
    if (temp[4].split(" ")[0] != "Exited") {
      await execSync("sudo docker kill " + projid)
    }
    await execSync("sudo docker rm " + projid)
    await execSync("sudo docker rmi $(sudo docker images | grep '"+ projid +"')")
  }
}


app.post('/indexer' , async function (request: Request, response: Response, next: NextFunction) {
  let user : string = request.body.user;
  let repo : string = request.body.repo;
  let branch : string = request.body.branch;
  let projid : string = request.body.projid;

  await verifyContainer(projid);

  try {
    let data : string = "FROM node:alpine\nWORKDIR /home/node/app\nRUN apk update && apk add git && npm install --location=global ts-node\n";
    data += "RUN git clone https://github.com/" + user + "/" + repo + " -b " + branch+"\n"
    data += "WORKDIR /home/node/app/" + repo + "\n"
    data += "RUN npm install\n"
    data += "RUN npm i js-yaml\n"
    data += "RUN npm i axios\n"
    data += "RUN npm i aws-sdk\n"
    data += "COPY ./serverSide ./serverSide\n"
    data += "WORKDIR /home/node/app/" + repo + "/serverSide\n"
    data += "RUN ts-node ./generatorMain.ts\n"
    data += "WORKDIR /home/node/app/" + repo + "\n"
    data += "ENV PROJECT_ID " + projid + "\n" 
    data += "CMD [\"ts-node\", \"./generated/EventRouter.ts\"]\n"
    await fs.writeFile("./Dockerfile.processor", data, function (err) {
      if (err) {
        throw err 
      } else {
        // RUNNING DOCKER CONTAINER
        execSync("sudo docker build -f Dockerfile.processor -t " + projid + ":latest .");
        execSync("sudo docker run -d --name " + projid + " " + projid + ":latest");

        response.status(200).send(
          {
            "status": "success",
            statusCode : 200
          }
        );
      }
    });
  } catch (error : any) {
    console.log(error.stderr.toString());
    
    if (error.stderr.toString().includes("branch" + branch + " not found")) {
      console.log("Branch not found");
      response.status(406).send({error: "Branch not found",statusCode : 406});
      return
    } else if (error.stderr.toString().includes(user + "/" + repo + "/' not found")) {
      console.log("Repo doesn't exist or is private");
      response.status(406).send({
        error: "Repo doesn't exist or is private",
        statusCode : 406
      });
      return
    } else {
      console.log("Unknown error");
      response.status(406).send({
        error: error.stderr.toString(),
        statusCode : 406
      });
      return
    }
  }
})

app.post('/apollo',async function (request: Request, response: Response, next: NextFunction) {
  let user : string = request.body.user;
  let repo : string = request.body.repo;
  let branch : string = request.body.branch;
  let projid : string = request.body.projid;
  let link = "https://raw.githubusercontent.com/" + user + "/" + repo + "/" + branch + "/";
  let result = await axios.get(link + "indexer.yaml")
  let indexerYAML =  yaml.load(result.data)
  result = await axios.get(link + "entities.yaml")
  let docs =  yaml.load(result.data)
  
  let name = indexerYAML.solName
  const PROJECTID = projid;

  let data = ""

  const dataTypes = {
    string:"String",
    number:"Int",
    boolean:"Boolean"
};

const imports = `const { ApolloServer, gql } = require("apollo-server");
const { unmarshall } = require("@aws-sdk/util-dynamodb");
const { DynamoDBClient, ScanCommand } = require("@aws-sdk/client-dynamodb");

const client = new DynamoDBClient({ region: "us-east-2" });\n`;

data += imports;

let schema = 'const typeDefs = gql`'
schema = schema + '\n\t' + 'scalar JSON';
let queries : string[] = [];
docs.entities.map((entity) => {
    queries.push(entity.name);
    schema = schema + '\n\t' + 'type ' + entity.name + ' {'
    entity.params.map((param) => {
        schema = schema + '\n\t\t'+ param.name+" : "+dataTypes[param.type]+ (param.primary ? "!" : "");
    })
    schema = schema + '\n\t}';
});

schema = schema + '\n\t' + 'type Query {'
queries.map((query) => {
    schema = schema + '\n\t\t' + (query ? query.charAt(0).toLowerCase() + query.slice(1) : "") + ": ["+query+"]"
})
schema = schema + '\n\t}\n`;\n';
console.log(schema);
data += schema;
// DynamoDB Retrieve Data
let sampleDB = `const getENTITY = async() => {
    const params = {
        TableName: \"TABLE_NAME\"
    };

    try {
        const results = await client.send(new ScanCommand(params));
        const data = [];
        results.Items.forEach((item) => {
            data.push(unmarshall(item));
        });
        return data;
    } catch (err) {
        console.error(err);
        return err;
    }
};`
let retrievers = "";
queries.map((entity) => {
    retrievers += sampleDB.replace("ENTITY",(entity ? entity.charAt(0).toUpperCase() + entity.slice(1) : "")).replace("TABLE_NAME",PROJECTID+"_"+entity);
})
console.log(retrievers);
data+=retrievers;


// Resolvers
let resolvers = `const resolvers = {
    Query: {\n`;
queries.map((query) => {
    resolvers += '\t\t' + (query ? query.charAt(0).toLowerCase() + query.slice(1) : "") + ": () => { return get"+(query ? query.charAt(0).toUpperCase() + query.slice(1) : "")+"(); },\n"
})
resolvers += `},
};`;
console.log(resolvers);
data+=resolvers;

let server = `const server = new ApolloServer({
    typeDefs,
    resolvers,
});

server.listen().then(({ url }) => {\n\t`;
server += "console.log(`🚀  Server ready at ${url}`);\n});";

console.log(server);
data+=server;

await fs.writeFile("./index.js", data, function (err) {
    if (err) {
      throw err 
    } else {
      // RUNNING DOCKER CONTAINER
      execSync("sudo docker build -q -f Dockerfile.apollo -t " + projid + ":latest .");
      execSync("sudo docker run -d --name " + projid + " " + projid + ":latest");

      response.status(200).send(
        {
          "status": "success",
          statusCode : 200
        }
      );
    }
  });
})


app.listen(port, () => {
  console.log(`Application is running on port ${port}.`);
});