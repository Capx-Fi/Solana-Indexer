module.exports = async(eventObject) => {
    let _eventObject = {};
    try{
        _eventObject = {
            event: "Mint Derivative",
            derivativeAddress: eventObject.derivativeToken.toBase58(),
            projectTokenAddress: eventObject.baseTokenAddress.toBase58(),
            mintAmount: parseInt(eventObject.amount.toString(10))
        };
    } catch (err) {
        console.log("Error Processing Mint Derivative Event :\n",err);
    }
    return _eventObject;
}