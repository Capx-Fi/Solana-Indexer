// CLIENT SIDE GENERATION TO TYPE CHECK THE CODE TYPED BY USER

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
    ]
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
if (fs.existsSync("../generated/mapping.ts")) {
    fs.unlinkSync('../generated/mapping.ts')
}

const doc  = yaml.load(fs.readFileSync('../indexer.yaml', 'utf8')) as yamlInterface;
const entitydoc = yaml.load(fs.readFileSync("../entities.yaml", 'utf8')) as entityInterface;
const eventList = doc["dataSources"][0]["mapping"]["eventHandlers"].map(event => parseEventString(event));
const entityList = entitydoc["entities"] ;

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
    logger.write("\t\treturn null;\n\t}\n")


    logger.write("\n\tasync save() : Promise<void> {\n\t}\n")
}

logger.write("}\n")



logger.close();

// var logger : fs.WriteStream = fs.createWriteStream('../generated/EventRouter.ts', {
//     flags: 'a'
// })


// logger.write("import {")
// for (let index = 0; index < eventList.length; index++) {
//     const element = eventList[index];
//     logger.write("\n\t"+ element["handler"] + ",")
// }
// logger.write("\n} from '../mapping';\n\n")

// logger.write("import {")
// for (let index = 0; index < eventList.length; index++) {
//     const element = eventList[index];
//     logger.write("\n\t"+ element["name"].replace(/\s/g, "") + ",")
// }
// logger.write("\n} from './Interfaces';\n\n")

// logger.write("import { PublicKey } from \"@solana/web3.js\";\n")
// logger.write("import { BN } from \"@project-serum/anchor\";\n\n\n")

// logger.write("function handleEvents(json : string) : void {")
// logger.write("\n\tlet params;")
// logger.write("\n\tlet event : any = JSON.parse(json);")
// logger.write("\n\tswitch (event.name) {")
// for (let index = 0; index < eventList.length; index++) {
//     const element = eventList[index];
//     logger.write("\n\t\tcase \""+element["name"]+"\":")
//     for (let index = 0; index < element["params"].length; index++) {
//         const element1 = element["params"][index];
//         logger.write("\n\t\t\tparams."+element1["name"]+" = event.params."+element1["name"]+" as " + mapper.get(element1["type"]) +";")
//     }
//     logger.write("\n\t\t\tparams = event[\"params\"] as " + element["name"].replace(/\s/g, "") + ";")
//     logger.write("\n\t\t\t"+element["handler"]+"(params);")
//     logger.write("\n\t\t\tbreak;")
// }
// logger.write("\n\t}")
// logger.write("\n}")


// logger.close();
// var logger : fs.WriteStream = fs.createWriteStream('../generated/mapping.ts', {
//     flags: 'a'
// })

// logger.write("import {")
// for (let index = 0; index < eventList.length; index++) {
//     const element = eventList[index];
//     logger.write("\n\t"+ element["name"].replace(/\s/g, "") + ",")
// }
// logger.write("\n} from './Interfaces';\n\n")

// for (let index = 0; index < eventList.length; index++) {
//     const element = eventList[index];
//     logger.write("export async function "+element["handler"].replace(/\s/g, "")+"(params : "+element["name"].replace(/\s/g, "")+") {")
//     logger.write("\n\t//TODO: Implement")
//     logger.write("\n}\n\n")
// }

// logger.close()
