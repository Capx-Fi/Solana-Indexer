const axios = require('axios');
const { clusterApiUrl } = require("@solana/web3.js"); 
const sleep = (time) => {
    return new Promise((resolve) => setTimeout(resolve, Math.ceil(time * 1000)));
};

// Helper Functions
const hash = require("object-hash");
const sendMessage = require("./sqs/sendMessage");

async function getSlot(_network, _commitment) {
    var data = JSON.stringify({
        "jsonrpc": "2.0",
        "id": 1,
        "method": "getSlot",
        "params": [
          {
            "commitment": _commitment
          }
        ]
    });
    var config = {
        method: 'post',
        url: clusterApiUrl(_network),
        headers: { 
          'Content-Type': 'application/json'
        },
        data : data
    };
    return axios(config)
    .then(function (response) {
        return response.data.result;
    })
    .catch(function (error) {
        console.log(error);
    });
}

async function getBlock(_network, _commitment, _slot) {
    var data = JSON.stringify({
        "jsonrpc": "2.0",
        "id": 1,
        "method": "getBlock",
        "params": [
            _slot,
          {
            "encoding": "jsonParsed",
            "transactionDetails": "full",
            "rewards": false,
            "commitment": _commitment
          }
        ]
    });
    var config = {
        method: 'post',
        url: clusterApiUrl(_network),
        headers: { 
          'Content-Type': 'application/json'
        },
        data : data
    };
    return axios(config)
    .then(function (response) {
        return response.data;
    })
    .catch(function (error) {
        console.log(error);
    });
}

function parseBlock(block, slot) {
    // Get Transactions corresponding to this slot.
    let txSignatures = [];
    let logs = [];
    block.transactions.map( async(transaction) => {
        logs.push(transaction.meta.logMessages);
        txSignatures.push(transaction.transaction.signatures);
    });
    logs = logs.join(",").split(",");
    txSignatures = txSignatures.join(",").split(",");
    return {
        slot: slot,
        blockHeight: block.blockHeight,
        blockHash: block.blockhash,
        blockTime: block.blockTime,
        parentSlot: block.parentSlot,
        transactions: txSignatures,
        blockLogs: logs
    }
}

const apiIndexer = async() => {
    let slot = await getSlot("devnet","finalized");
    let flag = true;
    while(flag) {
        console.log("Processing Slot", slot);
        let block = await getBlock("devnet","finalized",slot);
        let sqsObject = parseBlock(block.result, slot);
        let sqsObjectHash = hash(sqsObject);
        console.log(sqsObjectHash);
        await sendMessage(sqsObject, sqsObjectHash);
        await sleep(5);
        slot+=1;
    }
}

apiIndexer();