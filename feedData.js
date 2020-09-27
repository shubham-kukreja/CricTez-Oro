const conseiljs = require("conseiljs");
const puppeteer = require("puppeteer");
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
// FETCH PLAYER DETAILS
let totalPlayersUpdated = 0;

const scrapePlayerPoints = async (url) => {
  const browser = await puppeteer.launch();
  const page = await browser.newPage();
  await page.goto(url);
  const data = await page.evaluate(() => {
    let first = document
      .querySelector(".top-players__top-player")
      .innerText.replace(/(\r\n|\n|\r)/gm, "\t")
      .split("\t");
    const first_playerId = document.querySelectorAll(".js-headshot")[0]
      .attributes["data-player-id"].value;
    const first_rank = parseInt(first[0]);
    const first_name = first[1] + " " + first[2];
    const first_points = first[3];
    let table = document
      .getElementsByTagName("tbody")[0]
      .innerText.replace(/(\r\n|\n|\r)/gm, "\t")
      .split("\t");
    let a = [
      {
        rank: first_rank,
        name: first_name,
        points: parseInt(first_points),
        playerId: first_playerId,
      },
    ];
    for (var i = 23; i < table.length; i += 11) {
      const rank = parseInt(table[i]);
      const name = table[i + 1];
      const points = parseInt(table[i + 2]);
      let playerId = document
        .getElementsByClassName("top-players__player-link")
        [rank - 1].href.match(/\d+/g)[1];
      a.push({
        rank,
        name,
        points,
        playerId,
      });
    }
    return a;
  });
  data.forEach(async (item) => await updateData(item));
  await browser.close();
  return data;
};

const updateData = async (data) => {
  try {
    const update = await axios.put(
      `https://crictez-api.herokuapp.com/api/players/update/${data.playerId}`,
      { rank: data.rank, points: data.points }
    );
    console.log({ id: data.playerId, rank: data.rank, points: data.points });
    totalPlayersUpdated++;
  } catch (err) {
    console.log(err.message);
  }
  console.log(totalPlayersUpdated);
};

const fetchDataFromAPI = () => {
  scrapePlayerPoints("https://www.iplt20.com/stats/2020/player-points").then(
    (res) => {
      console.log("Data Updated. Now Fetching.");
      axios
        .get(
          "https://crictez-api.herokuapp.com/api/players/getplayerpoints/all"
        )
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
    }
  );
};
fetchDataFromAPI();
