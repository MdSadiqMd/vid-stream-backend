const cors = (c: any, next: any) => {
    c.header('Access-Control-Allow-Origin', '*');
    c.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');
    return next();
};

export default cors;