const axios = require("axios");
const agentURL = "http://52.1.239.123:26668/addHash";

module.exports = async(_objectHash) => {
    let status = false;
    try{
        let res = axios.post(
            agentURL,
            {
                hash: _objectHash
            }
        );
        let data = await res;
        status = data.data.status;
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