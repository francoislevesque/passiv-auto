const path = require("path");
const axios = require("axios");
const dotenv = require("dotenv");
const prompt = require("prompt");

prompt.start();

dotenv.config({ path: path.resolve(__dirname, ".env") });

// Account Variables
let EMAIL = process.env.EMAIL;
let PASSWORD = process.env.PASSWORD;

// API Variables
const API_URL = "https://api.passiv.com/api/v1/";
const AUTH_ENDPOINT = "auth/login";
const PORTFOLIO_GROUP_ENDPOINT = "portfolioGroups/";
const PG_INFO_ENDPOINT = "portfolioGroups/:id/info";
const IMPACT_ENDPOINT = "portfolioGroups/:pgid/calculatedtrades/:ctid/impact";
const PLACE_ORDERS_ENDPOINT =
  "portfolioGroups/:pgid/calculatedtrades/:ctid/placeOrders";

// Sign in
console.log("Signing in...");

// Ask for user input if credentials not found
let session = axios.create({
  withCredentials: true,
});

let jwt_header = {};

start();

async function start() {
  if (EMAIL == null) {
    const res = await prompt.get({ properties: { email: { hidden: false } } });
    EMAIL = res.email;
  }

  if (PASSWORD == null) {
    const res = await prompt.get({
      properties: { password: { hidden: true } },
    });
    PASSWORD = res.password;
  }

  session
    .post(API_URL + AUTH_ENDPOINT, {
      email: EMAIL,
      password: PASSWORD,
    })
    .then((login_response) => {
      let login_response_json = login_response.data;

      if ("token" in login_response_json) {
        jwt_header = {
          Authorization: "JWT " + login_response_json.token,
        };

        console.log("Success!");
        fetchOrders();
      } else {
        console.error("Token not found in response!");
      }
    })
    .catch((error) => {
      console.error(error);
    });
}

async function fetchOrders() {
  console.log("Fetching available orders...");

  // Fetch the portfolio groups
  const response = await session.get(API_URL + "portfolioGroups/", {
    headers: jwt_header,
  });

  let groups = response.data;

  groups.forEach(async (group) => {
    await getPortfolioGroupInfo(group);
  });
}

async function getPortfolioGroupInfo(group) {
  try {
    // prettier-ignore
    const url = API_URL + PG_INFO_ENDPOINT.replace(":id", group.id);

    const response = await session.get(url, { headers: jwt_header });

    let groupInfo = response.data;

    console.log(group.name + ":");

    // Find the calculated trades
    if ("calculated_trades" in groupInfo) {
      let calculated_trades = groupInfo.calculated_trades;
      handleCalculatedTrades(group, calculated_trades);
    }
  } catch (error) {
    console.error(error.response.data);
  }
}

async function handleCalculatedTrades(group, calculatedTrades) {
  if (calculatedTrades.trades.length == 0) {
    console.log(" (none)");
    return;
  }

  // List each potential trade
  calculatedTrades.trades.forEach((trade) => {
    console.log(
      ` - ${trade.action} ${trade.units} ${trade.universal_symbol.symbol} @ $${
        trade.price
      }${trade.universal_symbol.currency.code} for $${
        trade.price * trade.units
      }`
    );
  });

  // Check the impact of the trade beforehand
  if (await getTradeImpact(group, calculatedTrades)) {
    await placeOrders(group, calculatedTrades);
  }
}

async function getTradeImpact(group, calculatedTrades) {
  try {
    // prettier-ignore
    const url = API_URL + IMPACT_ENDPOINT.replace(":pgid", group.id).replace(":ctid", calculatedTrades.id);

    const response = await session.get(url, {
      headers: jwt_header,
    });

    console.log(response.data);

    if ("detail" in response.data) {
      console.log(response.data.detail);
    } else {
      return true;
    }
  } catch (error) {
    console.error(error.response.data);
  }

  return false;
}

async function placeOrders(group, calculatedTrades) {
  try {
    // prettier-ignore
    const url  = API_URL + PLACE_ORDERS_ENDPOINT.replace(":pgid", group.id).replace(":ctid", calculatedTrades.id);

    const response = await session.post(url, {}, { headers: jwt_header });

    console.log(response.data);

    if ("detail" in response.data) {
      console.log(response.data.detail);
    } else {
      console.log("Orders executed!");
    }
  } catch (error) {
    console.error(error.response.data);
  }
}
