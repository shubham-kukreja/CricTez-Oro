const conseiljs = require("conseiljs");
const axios = require("axios");
const tezosNode = "https://carthagenet.smartpy.io";
conseiljs.setLogLevel("error");
require("dotenv").config();

const conseilServerInfo = {
  url: "https://conseil-dev.cryptonomic-infra.tech:443",
  apiKey: process.env.API_KEY,
  network: "carthagenet",
};

const clearRPCOperationGroupHash = (opID) => {
  return opID.replace(/\"/g, "").replace(/\n/, "");
};

const invokeContract = (michelsonParameter) => {
  const keystore = {
    publicKey: process.env.PUBLIC_KEY,
    privateKey: process.env.PRIVATE_KEY,
    publicKeyHash: process.env.PUBLIC_HASH,
    seed: "",
    storeType: conseiljs.StoreType.Fundraiser,
  };
  const contractAddress = process.env.CONTRACT_ADDRESS;

  conseiljs.TezosNodeWriter.sendContractInvocationOperation(
    tezosNode,
    keystore,
    contractAddress,
    0,
    100000,
    "",
    1000,
    900000,
    undefined,
    michelsonParameter,
    conseiljs.TezosParameterFormat.Michelson
  )
    .then((response) => {
      console.log(response.operationGroupID);
      return conseiljs.TezosConseilClient.awaitOperationConfirmation(
        conseilServerInfo,
        conseilServerInfo.network,
        clearRPCOperationGroupHash(response.operationGroupID),
        5,
        30 + 1
      );
    })
    .then((conseilResponse) => {
      console.log("Last Updated At : ", new Date());
      setTimeout(fetchDataFromAPI, process.env.TIMER);
    })
    .catch((error) => {
      console.log("Error", error);
    });
};

const fetchDataFromAPI = () => {
  axios
    .get("https://crictez-api.herokuapp.com/api/players/getplayerpoints/all")
    .then((response) => {
      let buildUpMichelson = ``;
      for (let i = 0; i < response.data.length; i++) {
        buildUpMichelson =
          buildUpMichelson +
          `Pair ${response.data[i].player_id} (Pair ${response.data[i].points} ${response.data[i].rank}); `;
      }
      buildUpMichelson =
        `(Left (Right (Right (Right (Left {` + buildUpMichelson + `})))))`;
      return buildUpMichelson;
    })
    .then((responseMichelson) => {
      console.log("Invocation Initialized");
      invokeContract(responseMichelson);
    })
    .catch((error) => {
      console.log(error);
    });
};
fetchDataFromAPI();


