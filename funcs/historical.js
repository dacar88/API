const axios = require("axios");
const csv = require("csvtojson");
const countryMap = require('./countryMap');

var base =
  "https://raw.githubusercontent.com/CSSEGISandData/COVID-19/master/csse_covid_19_data/csse_covid_19_time_series/";


var historical_v2 = async (keys, redis) => {
  let casesResponse, deathsResponse;
  try {
    casesResponse = await axios.get(`${base}time_series_covid19_confirmed_global.csv`);
    deathsResponse = await axios.get(`${base}time_series_covid19_deaths_global.csv`);
  } catch (err) {
    console.log(err);
    return null;
  }

  const parsedCases = await csv({
    noheader: true,
    output: "csv"
  }).fromString(casesResponse.data);

  const parsedDeaths = await csv({
    noheader: true,
    output: "csv"
  }).fromString(deathsResponse.data);

  // to store parsed data
  const result = [];
  // dates key for timeline
  console.log("parsedCases", parsedCases)
  const timelineKey = parsedCases[0].splice(4);
  console.log("timelineKey", timelineKey)

  // loop over all country entries
  for (let b = 0; b < parsedDeaths.length;) {
    const timeline = {
      cases: {},
      deaths: {},
    };
    const c = parsedCases[b].splice(4);
    const d = parsedDeaths[b].splice(4);
    for (let i = 0; i < c.length; i++) {
      timeline.cases[timelineKey[i]] = parseInt(c[i]);
      timeline.deaths[timelineKey[i]] = parseInt(d[i]);
    }
    result.push({
      country: countryMap.standardizeCountryName(parsedCases[b][1].toLowerCase()),
      province: parsedCases[b][0] === "" ? null : countryMap.standardizeCountryName(parsedCases[b][0].toLowerCase()),
      timeline
    });
    b++;
  }

  const removeFirstObj = result.splice(1);
  const string = JSON.stringify(removeFirstObj);
  redis.set(keys.historical_v2, string);
  console.log(`Updated JHU CSSE Historical: ${removeFirstObj.length} locations`);
};

/**
 * Parses data from historical endpoint to and returns data for specific country. 
 * @param {*} data: full historical data returned from /historical endpoint
 * @param {*} country: country query param
 */
async function getHistoricalCountryData_v2(data, country) {
  const standardizedCountryName = countryMap.standardizeCountryName(country.toLowerCase());
  const countryData = data.filter(obj => obj.country.toLowerCase() == standardizedCountryName);

  // overall timeline for country
  const timeline = { cases: {}, deaths: {} };
  // sum over provinces
  for (var province = 0; province < countryData.length; province++) {
    // loop cases, recovered, deaths for each province
    Object.keys(countryData[province].timeline).forEach(specifier => {
      Object.keys(countryData[province].timeline[specifier]).forEach(date => {
        if (timeline[specifier][date]) {
          timeline[specifier][date] += parseInt(countryData[province].timeline[specifier][date]);
        }
        else {
          timeline[specifier][date] = parseInt(countryData[province].timeline[specifier][date]);
        }
      });
    });
  }

  return ({
    country: standardizedCountryName,
    timeline
  });
}

/**
 * Parses data from historical endpoint to and returns data for specific province.
 * @param {*} data: full historical data returned from /historical endpoint
 * @param {*} province: province query param
 */
async function getHistoricalProvinceData_v2(data, province) {
  console.log("province", province);
  const provinceData = data.filter(obj => obj.province == province.toLowerCase());
  console.log("provinceData", provinceData);

  const timeline = {cases: {}, deaths: {}};

  if(typeof provinceData !== 'undefined' && provinceData.length > 0) {
    // loop cases, deaths for the province
    Object.keys(provinceData[0].timeline).forEach(specifier => {
      Object.keys(provinceData[0].timeline[specifier]).forEach(date => {
        if (timeline[specifier][date]) {
          timeline[specifier][date] += parseInt(provinceData[0].timeline[specifier][date]);
        }
        else {
          timeline[specifier][date] = parseInt(provinceData[0].timeline[specifier][date]);
        }
      });
    });
  }

  return ({
    province: province,
    timeline
  });
}

module.exports = {
  historical_v2,
  getHistoricalCountryData_v2,
  getHistoricalProvinceData_v2
};
