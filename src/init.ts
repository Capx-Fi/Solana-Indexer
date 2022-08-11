#!/usr/bin/env node

const {
    Connection,
    PublicKey,
    clusterApiUrl,
    Keypair,
    LAMPORTS_PER_SOL,
    Transaction,
    SystemProgram,
    sendAndConfirmTransaction
} = require("@solana/web3.js");

const anchor = require("@project-serum/anchor");
const { execSync } = require('child_process');
const {
    Program,
    EventParser
} = require("@project-serum/anchor");
const { default: NodeWallet} = require("@project-serum/anchor/dist/cjs/nodewallet");
const web3 = require("@solana/web3.js");

// let idl = require("../indexer/main/idl/program.json");
// let connection = new web3.Connection(web3.clusterApiUrl('devnet'),"finalized");
let keyPair = anchor.web3.Keypair.generate();

let nodeWallet = {payer: keyPair};
// let provider = new anchor.AnchorProvider(connection, nodeWallet, {commitment: "finalized",});

// let program = new Program(idl, "5NbXrgnFeKfwpCPhpwFRrRZ8GqRCDpo94ohuHDBEPzdH", provider);
// let eventParser = new EventParser("5NbXrgnFeKfwpCPhpwFRrRZ8GqRCDpo94ohuHDBEPzdH", program.coder);

const yaml = require('js-yaml');
const inquirer = require('inquirer');
const fs = require('fs');
const { stringify } = require("querystring");

async function checkProgram(programId, network) {
    const connection = new Connection(clusterApiUrl(network),"confirmed");
    connection.getSlot("finalized");
    const programInfo = await connection.getAccountInfo(new PublicKey(programId));
    if (programInfo === null) {
        return false;
    } else if (!programInfo.executable) {
        return false;
    }
    return true;
}

function validateFile(file) {
    try{
        const jsonString = fs.readFileSync(file);
        const program = JSON.parse(jsonString);
        if(program.version != null) {
            return true;
        }
        else {
            return false;
        }
    } catch (err) {
        return false;
    }
}

const indexerInputs = () => {
    const questions = [
        {
            type: "list",
            name: "NETWORK",
            message: "Choose Solana Network :",
            choices: ["devnet","testnet","mainnet-beta"]
        },{
            type: "input",
            name: "INDEXER_NAME",
            message: "Enter Indexer Name :",
            validate: function(val) {
                if(val == "") {
                    return false;
                }
                return true;
            }
        },
        {
            type: "input",
            name: "PROJECT_ID",
            message: "Enter Project ID :",
            validate: function(val) {
                if(val == "") {
                    return false;
                }
                return true;
            }
        },
        {
            type: "input",
            name: "PROGRAM_NAME",
            message: "Enter Program Name :",
            validate: function(val) {
                if(val == "") {
                    return false;
                }
                return true;
            }
        },
        {
            type: "input",
            name: "PROGRAM_ID",
            message: "Enter Program ID :",
            validate: function(val) {
                if(val == "") {
                    return false;
                }
                return true;
            }
        },
        {
            type: "input",
            name: "PROGRAM_IDL",
            message: "IDL File Path (JSON File) :",
            validate: function(val) {
                if(val != "" && val.includes(".json")) {
                    return true;
                }
                return false;
            }
        },
        {
            type: "number",
            name: "PROGRAM_HEIGHT",
            message: "Enter the START Block Height :",
            validate: function(val) {
                if(val != ""){
                    return true;
                }
                return false;
            }
        }
    ];
    return inquirer.prompt(questions);
}

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

function transformIDL(answers) {
    try {
        const jsonString = fs.readFileSync(answers.PROGRAM_IDL);
        const program = JSON.parse(jsonString);
        let entities = [];
        let eventHandlers = [];
        let eventHandlerFunctions = [];
        program.events.map((event) => {
            entities.push(event.name);
            let eventFields = []
            event.fields.map((field) => {
                if(field.index) {
                    eventFields.push(field.name + " indexed " + field.type)
                }else {
                    eventFields.push(field.name + " " + field.type)
                }
            });
            eventHandlerFunctions.push("handle"+event.name);
            eventHandlers.push({
                event: event.name + "(" + eventFields.join(",") + ")",
                handler: "handle"+event.name
            });
        });
        return [{
            indexer: answers.INDEXER_NAME,
            schema: {
                file: "./schema.json"
            },
            dataSources: [
                {
                    kind: "solana/program",
                    projectID: answers.PROJECT_ID,
                    name: answers.PROGRAM_NAME,
                    network: answers.NETWORK,
                    source: {
                        programId: answers.PROGRAM_ID,
                        idl: answers.PROGRAM_NAME,
                        startBlock: answers.PROGRAM_HEIGHT,
                    },
                    mapping: {
                        kind: "solana/events",
                        entities: entities,
                        idls: [
                            {
                                name: answers.PROGRAM_NAME,
                                file: "./idls/"+answers.PROGRAM_NAME+".json"
                            }
                        ],
                        eventHandlers: eventHandlers,
                        file: "./src/mapping.ts"
                    }
                }
            ]
        }, eventHandlerFunctions];
    } catch (err) {
        console.log(err);
    }
}

async function generateProject(answers) {
    

    // Create Directory for the project
    if(!fs.existsSync("./"+answers.INDEXER_NAME)){
        fs.mkdirSync("./"+answers.INDEXER_NAME);
    }

    // Create YAML file inside the directory
    fs.openSync("./"+answers.INDEXER_NAME+"/indexer.yaml", 'w');

    // Get the Data to be written into the YAML file
    let [data, eventHandlers] = transformIDL(answers);
    // Write into the YAML file
    fs.writeFileSync("./"+answers.INDEXER_NAME+"/indexer.yaml", yaml.dump(data), (err) => {
        if (err) {
            console.log(err);
        }
    });

    // Create IDL folder inside the directory
    if(!fs.existsSync("./"+answers.INDEXER_NAME+"/idls")) {
        fs.mkdirSync("./"+answers.INDEXER_NAME+"/idls");
    }

    // Copy the IDL into the IDL folder
    fs.copyFile(answers.PROGRAM_IDL,"./"+answers.INDEXER_NAME+"/idls/"+answers.PROGRAM_NAME+".json", (err) => {
        if (err) throw err;
    });

    // Create SRC folder inside the directory
    if(!fs.existsSync("./"+answers.INDEXER_NAME+"/src")) {
        fs.mkdirSync("./"+answers.INDEXER_NAME+"/src");
    }

    // Create mapping.js file inside the directory
    // fs.openSync("./"+answers.INDEXER_NAME+"/src/mappings.js", 'w');
    createEntitiesYaml(answers);
    createMapping(answers,data["dataSources"][0].mapping.eventHandlers);
    if(!fs.existsSync("./"+answers.INDEXER_NAME+"/package")) {
        fs.mkdirSync("./"+answers.INDEXER_NAME+"/package");
    }
    fs.openSync("./"+answers.INDEXER_NAME+"/package/generator.ts", 'w');
    fs.copyFileSync(__dirname + "/generator.ts", "./"+answers.INDEXER_NAME+"/package/generator.ts");
    await createNPM(answers);
    await createTSconfig(answers);
    await installPackages(answers);
}

function createMapping(answers,eventHandlers) {

    var logger = fs.createWriteStream('./'+answers.INDEXER_NAME+'/src/mapping.ts', {
        flags: 'a'
    })
    
    let eventList = eventHandlers.map((event) => {
        return parseEventString(event.event, event.handler);
    })

    logger.write("import {")
    for (let index = 0; index < eventList.length; index++) {
        const element = eventList[index];
        logger.write("\n\t"+ element["name"].replace(/\s/g, "") + ",")
    }
    logger.write("\n} from '../generated/Interfaces';\n\n")
    
    for (let index = 0; index < eventList.length; index++) {
        const element = eventList[index];
        logger.write("export async function "+element["handler"].replace(/\s/g, "")+"(params : "+element["name"].replace(/\s/g, "")+") {")
        logger.write("\n\t//TODO: Implement")
        logger.write("\n}\n\n")
    }
    
}

export async function createYAML() {
    const answers = await indexerInputs();
    if(checkProgram(answers.PROGRAM_ID, answers.NETWORK)) {
        if(validateFile(answers.PROGRAM_IDL)){
            generateProject(answers);
        }
        else {
            console.log("Error: Invalid IDL File");
        }
    } else {
        console.log("Error: Invalid Program ID.\nEnsure: \n\t\t1. Built and deployed.\n\t\t2. Executable.");
    }
}

function createEntitiesYaml(answers) {
    fs.writeFileSync("./"+answers.INDEXER_NAME+"/entities.yaml" , yaml.dump({
        "entities": [
            {
                "name" : "SampleEntity",
                "params" : [
                    {
                        name : "PrimaryEntity",
                        type : "string",
                        primary : true
                    },
                    {
                        name : "NonPrimaryEntity",
                        type : "string",
                        primary : false
                    }
                ]
            }
        ]
    }), (err) => {
        if (err) {
            console.log(err);
        }
    })
}

async function createNPM(answers) {
    fs.openSync("./"+answers.INDEXER_NAME+"/package.json", 'w');
    fs.writeFileSync("./"+answers.INDEXER_NAME+"/package.json", JSON.stringify({
            "name": answers.INDEXER_NAME,
            "version": "1.0.0",
            "description": "",
            "main": "index.js",
            "scripts": {
              "build": "grapher build",
            },
            "author": "",
            "license": "ISC",
            "dependencies": {
              "@project-serum/anchor": "^0.25.0",
              "@types/node": "^18.6.5",
              "ts-node": "^10.9.1",
            }
    },null,2), (err) => {
        if (err) {
            console.log(err);
        }
    });
}

async function createTSconfig(answers) {
    fs.openSync("./"+answers.INDEXER_NAME+"/tsconfig.json", 'w');
    fs.writeFileSync("./"+answers.INDEXER_NAME+"/tsconfig.json", JSON.stringify({
        "compilerOptions": {
        "module": "commonjs",
        "declaration": true,
        "removeComments": true,
        "allowSyntheticDefaultImports": true,
        "target": "es2017",
        "sourceMap": false,
        "outDir": "./dist",
        "baseUrl": "./",
        "incremental": true
        },
        "include": ["src/**/*.ts"],
        "exclude": ["node modules","test","lib", "**/*spec.ts"]
      },null,2), (err) => {
    if (err) {
        console.log(err);
    }
});
}

function installPackages(answers) {
    execSync("cd "+answers.INDEXER_NAME+" && npm i");
}
