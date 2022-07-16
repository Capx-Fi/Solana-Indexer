module.exports = async(eventObject) => {
    let _eventObject = {};
    try{
        _eventObject = {
            event: "Burn Derivative",
            derivativeAddress: eventObject.derivativeToken.toBase58(),
            projectTokenAddress: eventObject.baseTokenAddress.toBase58(),
            burnAmount: parseInt(eventObject.amount.toString(10))
        };
    } catch (err) {
        console.log("Error Processing Burn Derivative Event :\n",err);
    }
    return _eventObject;
}