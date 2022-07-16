const axios = require("axios");
const sendMessage = require("../sqs/sendMessage");
const agentURL = "http://52.1.239.123:26668/checkHash";

module.exports = async(snsObject, snsObjectHash) => {
    let status = false;
    try{
        let res = axios.get(
            agentURL,
            { 
                params: {
                    hash: snsObjectHash
                }
            }
        );
        let data = await res;
        status = data.data.status;
        console.log("Hash Found :", status);
        if(!status){
            await sendMessage(snsObject, snsObjectHash);
        }
    } catch (err) {
        if (err.response) {
            console.log("Error in Response: ",err);
        } else if (err.request) {
            console.log("Error in Request: ",err);
        } else {
            console.log("Error",err);
        }
    }
    return status;
}