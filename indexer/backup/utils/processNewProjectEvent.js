module.exports = async(eventObject) => {
    let _eventObject = {};
    try{
        _eventObject = {
            event: "Project",
            tokenAddress: eventObject.tokenAddress.toBase58(),
            name: eventObject.name,
            description: eventObject.description,
            creator: eventObject.creator.toBase58(),
            decimal: eventObject.decimal.toString(10)
        };
    } catch (err) {
        console.log("Error Processing Project Event :\n",err);
    }
    return _eventObject;
}