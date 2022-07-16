module.exports = async(eventObject) => {
    let _eventObject = {};
    try{
        _eventObject = {
            event: "Derivative",
            derivativeAddress: eventObject.derivativeToken.toBase58(),
            projectTokenAddress: eventObject.baseTokenAddress.toBase58(),
            unlockTime: parseInt(eventObject.dayTimestamp.toString(10)),
            totalSupply: 0
        };
    } catch (err) {
        console.log("Error Processing Derivative Event :\n",err);
    }
    return _eventObject;
}