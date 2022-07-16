
const anchor = require("@project-serum/anchor");
const { Program } = require("@project-serum/anchor");
const { default: NodeWallet} = require("@project-serum/anchor/dist/cjs/nodewallet");
const web3 = require("@solana/web3.js");

// Helper Functions
const sendMessage = require("./sqs/sendMessage");
const hash = require("object-hash");

// Processing the Event Object
const project = require("./utils/processNewProjectEvent");
const createWVT = require("./utils/processCreateDerivativeEvent");
const mintWVT = require("./utils/processMintDerivativeEvent");
const burnWVT = require("./utils/processBurnDerivativeEvent");

let idl = require("./idl/program.json");

let connection = new web3.Connection(web3.clusterApiUrl('devnet'),'processed');
let keyPair = anchor.web3.Keypair.generate();

let nodeWallet = {payer: keyPair};
let provider = new anchor.AnchorProvider(connection, nodeWallet, {commitment: "processed",});

let program = new Program(idl, "5NbXrgnFeKfwpCPhpwFRrRZ8GqRCDpo94ohuHDBEPzdH", provider);

async function _handleObject(eventObject) {
    return {
        event: "MyEvent",
        data: eventObject.data.toString(10),
        label: eventObject.label
    };
}

const indexer = async() => {
    await console.log("Indexer Running");

    let[event, slot] = await new Promise(
        (resolve, reject) => {
            // Test Event
            try {
                program.addEventListener("MyEvent", async (event,slot) => {
                    resolve([event, slot]);
                    // Breaking the Event structure and creating the Object corresponding to the event
                    let snsObject = await _handleObject(event);
                    let snsObjectHash = hash(snsObject);
                    await sendMessage(snsObject, snsObjectHash);
                }); 
            } catch (err) {
                console.log("Error Indexing Event: MyEvent\n",err);
            }
            // Test Event
            try {
                program.addEventListener("MyOtherEvent", async (event,slot) => {
                    resolve([event, slot]);
                    console.log(event);
                });
            } catch (err) {
                console.log("Error Indexing Event: MyOtherEvent\n",err);
            }
            // Project Creation Event
            try {
                program.addEventListener("NewProject", async (event,slot) => {
                    resolve([event, slot]);
                    // Breaking the Event structure and creating the Object corresponding to the event
                    let snsObject = await project(event);
                    let snsObjectHash = hash(snsObject);
                    console.log("Project Object",snsObject);
                    await sendMessage(snsObject, snsObjectHash);
                }); 
            } catch (err) {
                console.log("Error Indexing Event: NewProject\n",err);
            }
            // Derivative Creation Event
            try {
                program.addEventListener("Derivative", async (event,slot) => {
                    resolve([event, slot]);
                    // Breaking the Event structure and creating the Object corresponding to the event
                    let snsObject = await createWVT(event);
                    let snsObjectHash = hash(snsObject);
                    console.log("Derivative Object",snsObject);
                    await sendMessage(snsObject, snsObjectHash);
                }); 
            } catch (err) {
                console.log("Error Indexing Event: Derivative\n",err);
            }
            // Derivative Mint Event
            try {
                program.addEventListener("DerivativeMint", async (event,slot) => {
                    resolve([event, slot]);
                    // Breaking the Event structure and creating the Object corresponding to the event
                    let snsObject = await mintWVT(event);
                    let snsObjectHash = hash(snsObject);
                    console.log("Derivative Mint Object",snsObject);
                    await sendMessage(snsObject, snsObjectHash);
                }); 
            } catch (err) {
                console.log("Error Indexing Event: DerivativeMint\n",err);
            }
            // Derivative Burn Event
            try {
                program.addEventListener("DerivativeBurn", async (event,slot) => {
                    resolve([event, slot]);
                    // Breaking the Event structure and creating the Object corresponding to the event
                    let snsObject = await burnWVT(event);
                    let snsObjectHash = hash(snsObject);
                    console.log("Derivative Burn Object",snsObject);
                    await sendMessage(snsObject, snsObjectHash);
                }); 
            } catch (err) {
                console.log("Error Indexing Event: DerivativeBurn\n",err);
            }
        }
    )
}

indexer();