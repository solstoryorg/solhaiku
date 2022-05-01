import './pre-start'; // Must be the first import
import logger from 'jet-logger';
import server from './server';
import https from 'https';
import fs from 'fs';


// Constants
const serverStartMsg = 'Express server started on port: ',
        port = (process.env.PORT || 3000);

if (process.env.NODE_ENV === 'development') {

  // Constants
  const serverStartMsg = 'Express server started on port: ',
          port = (process.env.PORT || 3000);

  // Start server
  server.listen(port, () => {
      logger.info(serverStartMsg + port);
  });

}else{
  const privateKey = fs.readFileSync('/etc/letsencrypt/live/solhaiku.is/privkey.pem', 'utf8');
  const certificate = fs.readFileSync('/etc/letsencrypt/live/solhaiku.is/cert.pem', 'utf8');
  const chain = fs.readFileSync('/etc/letsencrypt/live/solhaiku.is/chain.pem', 'utf8');

  const serverOptions = {
    key: privateKey,
    cert: certificate,
    ca: [chain]
  };


  const httpsServ = https.createServer(serverOptions, server);
  // Start server
  httpsServ.listen(port, () => {
      logger.info(serverStartMsg + port);
  });
}
