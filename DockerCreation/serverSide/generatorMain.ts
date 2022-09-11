// GENERATOR FOR THE DOCKER INSTANCE

import * as fs from "fs";
import {PublicKey} from "@solana/web3.js";
import { BN} from "@project-serum/anchor";
import * as yaml from "js-yaml";

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
    ["publicKey" , "PublicKey"],
    ["bool" , "boolean"],
    ["string" , "string"],
    ["number","number"],
    ["u8" , "number"],
    ["i8" , "number"],
    ["u16" , "number"],
    ["i16" , "number"],
    ["u32" , "number"],
    ["i32" , "number"],
    ["f32" , "number"],
    ["f64" , "number"],
    ["u64" , "BN"],
    ["i64" , "BN"],
    ["u128" , "BN"],
    ["i128" , "BN"],
])

interface yamlInterface {
    indexer : string;
    solName : string;
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
                startBlock : number;
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
}

interface entityInterface {
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

if (!fs.existsSync("../generated")){
    fs.mkdirSync("../generated");
}

if (fs.existsSync("../generated/interfaces.ts")){
    fs.unlinkSync('../generated/Interfaces.ts')   
}
if (fs.existsSync("../generated/EventRouter.ts")){
    fs.unlinkSync('../generated/EventRouter.ts')
}
// fs.unlinkSync('./generated/mapping.ts')

const doc  = yaml.load(fs.readFileSync('../indexer.yaml', 'utf8')) as yamlInterface;
const entitydoc = yaml.load(fs.readFileSync("../entities.yaml", 'utf8')) as entityInterface;
const entityList = entitydoc["entities"] ;
const eventList = doc["dataSources"][0]["mapping"]["eventHandlers"].map(event => parseEventString(event));

//Checker Code
for (let index = 0; index < entityList.length; index++) {
    let primarycount = 0
    for (let index2 = 0; index2 < entityList[index]["params"].length; index2++) {
        if (entityList[index]["params"][index2]["primary"]) {
            primarycount+= 1
        }
    }

if (primarycount > 1) {
    throw new Error("Only one primary entity is allowed");
}

if (primarycount < 1) {
    throw new Error("At least one primary entity is required");
}
}

var logger : fs.WriteStream = fs.createWriteStream('../generated/Interfaces.ts', {
    flags: 'w+'
})

logger.write(`import { PublicKey } from "@solana/web3.js";\n`);
logger.write('import { loader } from "../serverSide/loadingFunction";\n');
logger.write('import { saver } from "../serverSide/savingFunction";\n');
logger.write(`import { BN } from "@project-serum/anchor";\n\n\n`);

for (let index = 0; index < eventList.length; index++) {
    const element = eventList[index];

    logger.write("export interface "+ element["name"].replace(/\s/g, "") + " {")
    for (let index = 0; index < element["params"].length; index++) {
        const element1 = element["params"][index];
        logger.write("\n\t" + "\"" + element1["name"].replace(/\s/g, "") + "\"" +  ":"+mapper.get(element1["type"])+";")
    }
    logger.write("\n}\n\n")
}

for (let index = 0; index < entityList.length; index++) {
    const element = entityList[index];

    logger.write("export class "+ element["name"].replace(/\s/g, "") + " {")
    for (let index = 0; index < element["params"].length; index++) {
        const element1 = element["params"][index];
        logger.write("\n\t" + "\"" + element1["name"].replace(/\s/g, "") + "\"" +  ":"+mapper.get(element1["type"])+";")
    }

    logger.write("\n\n\tstatic async load(")
    for (let index = 0; index < element["params"].length; index++) {
        const element1 = element["params"][index];
        if (element1["primary"] == true) {
            logger.write(element1["name"].replace(/\s/g, "") +  ":"+mapper.get(element1["type"]))
        }
    }
    logger.write(") : Promise<null | " + element["name"].replace(/\s/g, "") + "> {\n")
    logger.write("\t\tlet temp = await loader(\"" + element["name"].replace(/\s/g, "") + "\",")
    for (let index = 0; index < element["params"].length; index++) {
        const element1 = element["params"][index];
        if (element1["primary"] == true) {
            logger.write(element1["name"].replace(/\s/g, ""))
            logger.write(", \"")
            logger.write(element1["name"].replace(/\s/g, ""))
            logger.write("\"")
        }
    }
    logger.write(")\n\t\t")
    logger.write("if (temp === null) {")
    logger.write("\n\t\t\treturn null;")
    logger.write("\n\t\t}")
    logger.write("\n\t\tlet temp2 = new "+ element["name"].replace(/\s/g, "") +"();")
    for (let index = 0; index < element["params"].length; index++) {
        const element1 = element["params"][index];
        logger.write("\n\t\t\ttemp2." + element1["name"].replace(/\s/g, "") + " = temp[\"" + element1["name"].replace(/\s/g, "") + "\"];")
    }
    logger.write("\n\t\treturn temp2;")
    logger.write("\n\t}\n")

    logger.write("\n\tasync save() : Promise<void> {\n\t")
    for (let index = 0; index < element["params"].length; index++) {
        const element1 = element["params"][index];
        if (element1["primary"] == true) {
            logger.write("\tif (this." + element1["name"].replace(/\s/g, "") + " === null) {")
            logger.write("\n\t\t\tthrow new Error(\"" + element1["name"].replace(/\s/g, "") + " is null\");\n\t\t}")
        }
    }
    logger.write("\n\t\tlet temp = {}\n")
    for (let index = 0; index < element["params"].length; index++) {
        const element1 = element["params"][index];
        if (element1["type"].toLowerCase() == "publickey") {
            logger.write("console.log(typeof this." + element1["name"].replace(/\s/g, "") + ")\n")
            logger.write("console.log(this." + element1["name"].replace(/\s/g, "") + ")\n")
            logger.write("\t\ttemp[\"" + element1["name"].replace(/\s/g, "") + "\"] = typeof this." + element1["name"].replace(/\s/g, "") + " === \'undefined\' ? this." + element1["name"].replace(/\s/g, "") + " : this." + element1["name"].replace(/\s/g, "") + ";\n")    
        } else if (mapper.get(element1["type"]) == "BN" ) {
            logger.write("\t\ttemp[\"" + element1["name"].replace(/\s/g, "") + "\"] = this." + element1["name"].replace(/\s/g, "") + ";\n")    
        } else {
            logger.write("\t\ttemp[\"" + element1["name"].replace(/\s/g, "") + "\"] = this." + element1["name"].replace(/\s/g, "") + ";\n")
        }
    }
    logger.write("\n\t\tawait saver(\"" + element["name"].replace(/\s/g, "") + "\", temp)")
    logger.write("\n\t}")
    logger.write("}\n")
}



logger.close();
let progName = doc.dataSources[0].source.idl
let JSONstring = fs.readFileSync("../idls/" + progName + ".json" )
logger = fs.createWriteStream("../idls/" + progName + "_ts.ts")
logger.write("export type " + progName + " = " + JSONstring)
logger.write("\n\nexport const IDL: " + progName + " = " + JSONstring)
logger.close()



// network
// program id
// startslot
// program name

function replaceAll(string : string, search : string, replace : string) {
    return string.split(search).join(replace);
  }

  logger  = fs.createWriteStream('../generated/EventRouter.ts', {
    flags: 'a'
})

logger.write("import {")
for (let index = 0; index < eventList.length; index++) {
    const element = eventList[index];
    logger.write("\n\t"+ element["handler"] + ",")
}
logger.write("\n} from '../src/mapping';\n\n")

logger.write("import {")
for (let index = 0; index < eventList.length; index++) {
    const element = eventList[index];
    logger.write("\n\t"+ element["name"].replace(/\s/g, "") + ",")
}
logger.write("\n} from './Interfaces';\n\n")
let progID = doc.dataSources[0].source.programId
let network = doc.dataSources[0].network
let startslot = doc.dataSources[0].source.startBlock

let indexString : string = fs.readFileSync("./index.txt" ).toString()
indexString = replaceAll(indexString, "::::PROGRAM_NAME", progName)
indexString = replaceAll(indexString, "::::PROGRAM_ID", progID)
indexString = replaceAll(indexString, "::::NETWORK", network)
indexString = replaceAll(indexString, "::::START_SLOT", startslot.toString())
// IMPLEMENT FETCHING CLUSTER URL FROM DYNAMO DB
let clusterUrl = "https://solana-devnet.g.alchemy.com/v2/FN-j_DEecftJ-VAtcMzD72gzueeb82Mz"
indexString = replaceAll(indexString, "::::CLUSTER_URL", clusterUrl)
logger.write(indexString)
logger.write("\n\n\n")

logger.write("async function handleEvents(event : {name : string , params : object}) : void {")
logger.write("\n\tswitch (event.name) {")
for (let index = 0; index < eventList.length; index++) {
    const element = eventList[index];
    logger.write("\n\t\tcase \""+element["name"]+"\":")
    logger.write("\n\t\t\tawait "+element["handler"]+"(event[\"params\"] as "+ element["name"].replace(/\s/g, "") + ");")
    logger.write("\n\t\t\tbreak;")
}
logger.write("\n\t}")
logger.write("\n}")


logger.close();



