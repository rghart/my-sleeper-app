import React from 'react';
import './App.css';
import SearchBar from './SearchBar';
import SearchFilterButton from './SearchFilterButton';
import PlayerInfoItem from './PlayerInfoItem';
import Fuse from 'fuse.js';
import { auth } from './firebase.js';

class App extends React.Component {
  state = {
    playerInfo: {},
    leagueData: [],
    isLoading: true,
    loadingMessage: "Loading...",
    rankingPlayersIdsList: [],
    filteredPlayersIdsList: [],
    isTyping: false,
    searchText: "",
    checkedItems: ["QB", "RB", "WR", "TE", "K", "DEF"],
    showAvailable: true,
    showOnlyMyPlayers: true,
    leagueID: "662349421429727232",
    allLeagueIDs: [],
    rosterPositions: [],
    notFoundPlayers: [],
    lastUpdate: null,
    user: null,
    authToken: null
  };

  componentDidMount() {
    auth.onAuthStateChanged((user) => {
      if (user) {
        this.setState({
          user
        })
      }
    })
    auth.signInAnonymously()
      .then((result) => {
        const user = result.user;
        this.setState({
          user
        })
      })
      .then(() => {
        this.getPlayerData();
      })
      .catch(err => console.error('Error:', err));
  }
  // TODO clean up and pull out helper functions and search function into separate file(s)
  checkErrors = (response) => {
    if (!response.ok) {
      throw new Error(response.statusText, response.status)
    }
    return response;
  }

  putRequest = async (url, data) => {
    const response = await fetch(url, { 
      method: 'PUT', 
      headers: { 
        'Content-type': 'application/json'
      },
      body: JSON.stringify(data) 
    })
      .then(this.checkErrors)
      .catch(err => console.error('Error:', err));

    return response;
  }

  updatePlayerDB = async () => {
    // Attempt update to latest update attempt before calling Sleeper. return if that fails
    const updateResponse = await this.putRequest(`https://sleeper-player-db-default-rtdb.firebaseio.com/latest_update_attempt.json?auth=${this.state.authToken}`, new Date().getTime());
    if (updateResponse && updateResponse.ok) {
      const sleeperPlayerData = await fetch(`https://api.sleeper.app/v1/players/nfl`)
        .then(this.checkErrors)
        .then(response => response.json())
        .then(data => {
          console.log("Successfully fetched Sleeper Player data from API")
          let filteredData = Object.fromEntries(
            Object.entries(data)
            .filter(([key, val]) => val.active)
          )
          const currentDate = new Date().getTime();
          filteredData.latest_update_attempt = currentDate;
          this.setState({
            lastUpdate: currentDate
          })
          return filteredData;
        })
        .catch((error) => {
            console.error('Error:', error);
          });

      await this.putRequest(`https://sleeper-player-db-default-rtdb.firebaseio.com/.json?auth=${this.state.authToken}`, sleeperPlayerData);
    } else {
      console.log("Wasn't able to update latest_update_attempt field")
    }
  }

  getLatestUpdateAttempt = async () => {
    return await fetch(`https://sleeper-player-db-default-rtdb.firebaseio.com/latest_update_attempt.json?auth=${this.state.authToken}`)
      .then(response => response.json())
      .then(data => {
        this.setState({
          lastUpdate: data
        })
        return data;
      })
      .catch((error) => {
        console.error('Error:', error);
      });
  }

  // Need to update latest update time stamp before attempting to call Sleeper's API. 
  // This way if the update fails, or, succeeds and then the subsequent GET (Sleeper API) or PUT (my player DB) fails, we won't attempt to call Sleeper's API within 24 hours 
  getPlayerData = async () => {
    await auth.currentUser.getIdToken(true)
      .then((idToken) => {
        this.setState({
          authToken: idToken,
        });
      })
      .catch((error) => {
          // Handle error
        });
    const day = 24 * 60 * 60 * 1000;
    const currentDate = new Date().getTime();
    const latestUpdateAttempt = await this.getLatestUpdateAttempt();
    if (currentDate - latestUpdateAttempt >= day) {
      await this.updatePlayerDB();
    }
    await fetch(`https://sleeper-player-db-default-rtdb.firebaseio.com/.json?auth=${this.state.authToken}`)
      .then(response => response.json())
      .then(data => {
        this.setState({
          playerInfo: data,
        })
      })
      .catch((error) => {
        console.error('Error:', error);
      });
    this.getLeagueData();   
  }

  getLeagueData = async () => {
      this.setState({
        isLoading: true,
      });
    const leagueID = this.state.leagueID;
    const urls = [
      `https://api.sleeper.app/v1/league/${leagueID}/rosters`,
      `https://api.sleeper.app/v1/league/${leagueID}/users`,
      `https://api.sleeper.app/v1/league/${leagueID}`,
      `https://api.sleeper.app/v1/user/521035584588267520/leagues/nfl/2021`
    ]
    let requests = urls.map(url => fetch(url));
    Promise.all(requests)
      .then(responses => {
        return Promise.all(responses.map(response => {
          return response.json();
        }))
      })
      .then(data => {
        this.markTakenPlayers(data[0], data[1]);
        let leagueIds = data[3];
        this.setState({
          leagueData: data,
          isLoading: false,
          rosterPositions: data[2].roster_positions.filter(pos => pos !== "BN"),
          allLeagueIDs: leagueIds
        });
        if (this.state.rankingPlayersIdsList) {
            this.filterPlayers();
        }
      })
      .catch((error) => {
        console.error('Error:', error);
      });
  }

  markTakenPlayers = (rosterData, managerData) => {
    let playerObject = this.state.playerInfo;
    if (this.state.rankingPlayersIdsList) {
        for (let i = 0; i < Object.keys(playerObject).length + 1; i++) {
            if (playerObject[i]) {
                playerObject[i].is_taken = false;
                playerObject[i].rostered_by = null;
            }
        }
    }
    for (let i = 0; i < rosterData.length; i++) {
      const currentManagerId = rosterData[i].owner_id;
      const currentManagerData = managerData.find(manager => manager.user_id === currentManagerId);
      rosterData[i].manager_display_name = currentManagerData ? currentManagerData.display_name : "Unassigned";
      rosterData[i].players.forEach(player => {
        playerObject[player].is_taken = true;
        playerObject[player].rostered_by = rosterData[i].manager_display_name;
      })
    }
    this.setState({
      playerInfo: playerObject
    })
  }

  updateSearchText = (e) => {
      const searchText = e.target.value;
      this.setState({
        searchText
      });
    }

    updateLeagueID = (e) => {
        const leagueID = e.target.value;
        this.setState({
          leagueID
        });
    }

    handleChange = (e) => {
      const item = e.target.name;
      const index = this.state.checkedItems.indexOf(item);
      const checkedItems = this.state.checkedItems;
      index !== -1 ? checkedItems.splice(index, 1) : checkedItems.push(item);
      this.setState({
          checkedItems: checkedItems
      });
      this.filterPlayers();
    }

    startLoad = () => {
        this.setState({
          isLoading: true,
        }, () => {
            return this.updateRankings();
          });
    }

    updateRankings = async () => {
        let { playerInfo, searchText } = this.state;
        const playerInfoArray = Object.values(playerInfo);
        playerInfoArray.sort((a, b) => a.search_rank - b.search_rank);
        const playerInfoFuseOptions = {
            useExtendedSearch: true,
            includeScore: true,
            keys: [
                "search_last_name",
                "search_first_name",
                "team",
                "position"
            ]
        }
        const options = {
          includeScore: true
        }
        const positions = ['QB', 'RB', 'WR', 'TE', 'DEF', 'K'];
        const teams = ['CAR', 'MIN', 'TEN', 'GB', 'NO', 'NYG', 'KC', 'IND', 'LAC', 'DAL', 'BUF', 'CLE', 'SEA', 'ARI', 'LV', 'ATL', 'LAR', 'LA', 'FA', 'CIN', 'SF', 'JAX', 'JAC', 'WAS', 'CHI', 'PHI', 'BAL', 'TB', 'DEN', 'HOU', 'PIT', 'MIA', 'DET', 'NE', 'NYJ', 'ROOKIE'];
        const playerInfoFuse = new Fuse(playerInfoArray, playerInfoFuseOptions);
        const teamsFuse = new Fuse(teams, options);

        let addLineBreak = searchText.replace(/(?:\r\n|\r|\n)/g, '<br>')
        let splitLineBreak = addLineBreak.split('<br>');
        let searchResultsArray = [];
        let ranking = 1;
        let notFoundPlayers = [];

        splitLineBreak.forEach(line => {
            // Removing any numbers from the search string
            line = line.replace(/[0-9]/g, "");
            // Splitting the string
            let splitString = line.split("");
            // Making sure the first index isn't a period after removing numbers. Just in case we get "1., 2., 3."" etc
            if (splitString[0] === ".") {
              splitString.splice(0, 1, "");
            }
            // Sometimes ranks just have the first letter of the first name and the last name separated by a period. ex. "T.Brady"
            // Want to remove this without removing for players that go by initials, ex. "J.K. Dobbins"
            if (splitString[1] === "." && splitString[3] !== ".") {
              splitString.splice(1, 1, " ");
            }
            let nameAndTeam = splitString.join("").trim();
            // Splitting by spaces and removing whitespace
            let firstLastTeamArrays = nameAndTeam.split(/\s/).map(item => item.trim());
            let searchArray;
            let foundPositionStr;
            let foundTeamStr;
            // If there's more than 2 indexes, we want to see if they can help with our search by looking for player position and team initials
            if (firstLastTeamArrays.length > 2) {
              const positionIndex = firstLastTeamArrays.findIndex(item => positions.includes(item.replace(/[^a-zA-Z]/g, "")));
              if (positionIndex >= 0) {
                foundPositionStr = firstLastTeamArrays.splice(positionIndex, 1)[0];
              }
              foundTeamStr = this.getHighestScore(firstLastTeamArrays, teamsFuse);
              if (foundTeamStr) {
                firstLastTeamArrays.splice(firstLastTeamArrays.indexOf(foundTeamStr), 1);
              }
            }
            searchArray = [firstLastTeamArrays[0].replace(/[^a-zA-Z]/g, ""), firstLastTeamArrays[1].replace(/[^a-zA-Z]/g, ""), foundTeamStr, foundPositionStr];
            let results = playerInfoFuse.search({
              $or:[
                {
                  $and: [
                    { search_last_name: searchArray[1] },
                    { 
                      $or: [
                        { search_first_name: searchArray[0] },
                        { search_first_name: `^${searchArray[0]}` }
                      ] 
                    },
                    { position: `=${searchArray[3]}` },
                    { team: `=${searchArray[2]}` }
                  ],
                },
                // eslint-disable-next-line
                {
                  $and: [
                    { search_last_name: searchArray[1] },
                    { 
                      $or: [
                        { search_first_name: searchArray[0] },
                        { search_first_name: `^${searchArray[0]}` }
                      ] 
                    },
                    { position: `=${searchArray[3]}` }
                  ],
                },
                // eslint-disable-next-line
                {
                  $and: [
                    { search_last_name: searchArray[1] },
                    { 
                      $or: [
                        { search_first_name: searchArray[0] },
                        { search_first_name: `^${searchArray[0]}` }
                      ] 
                    },
                    { team: `=${searchArray[2]}` }
                  ],
                },
                // eslint-disable-next-line
                {
                  $and: [
                    { search_last_name: searchArray[1] },
                    { 
                      $or: [
                        { search_first_name: searchArray[0] },
                        { search_first_name: `^${searchArray[0]}` }
                      ] 
                    }
                  ]
                }
              ]
            });
            if (results[0]) {
                searchResultsArray.push({player_id: results[0].item.player_id, ranking: ranking});
                if (results[0].item.search_rank > 1000) {
                    console.log(`${results[0].item.full_name} ${results[0].item.position} ${results[0].item.team} Rank: ${ranking}`)
                }
            } else {
                notFoundPlayers.push(`Couldn't find ${firstLastTeamArrays[0]} ${firstLastTeamArrays[1]} ${foundTeamStr}  ${foundPositionStr} Rank: ${ranking}`);
            }
            ranking += 1;
        })

        await this.setState({
          rankingPlayersIdsList: searchResultsArray,
          isLoading: false,
          notFoundPlayers: notFoundPlayers,
          searchText: ""
        })
        this.filterPlayers();
    }

    getHighestScore = (arr, fuseSearch) => {
        let bestResult = arr
          .map(item => fuseSearch.search(item.replace(/[^a-zA-Z]/g, "")))
          .filter(item => item.length > 0)
          .sort((a, b) => a[0]?.score - b[0]?.score);
        return bestResult[0] ? bestResult[0][0].item : null;
    }

    filterPlayers = () => {
        const newPlayers = this.state.rankingPlayersIdsList.filter(player => this.state.checkedItems.includes(this.state.playerInfo[player.player_id].position) && (this.state.playerInfo[player.player_id].is_taken !== true || this.state.playerInfo[player.player_id].rostered_by === 'ryangh')).map(player => player.player_id);
        this.setState({
            filteredPlayersIdsList: newPlayers
        })
    }

    addToRoster = (playerInfo) => {
        let { rosterPositions } = this.state;
        if (playerInfo.position === "TE" || playerInfo.position === "RB" || playerInfo.position === "WR") {
            playerInfo.fantasy_positions.push("FLEX");
            playerInfo.fantasy_positions.push("SUPER_FLEX");
        } else if (playerInfo.position === "QB") {
            playerInfo.fantasy_positions.push("SUPER_FLEX");
        }

        for (let i = 0; i < playerInfo.fantasy_positions.length; i++) {
            const includesPosition = rosterPositions.includes(playerInfo.fantasy_positions[i]);
            if (includesPosition) {
                const positionIndex = rosterPositions.indexOf(playerInfo.fantasy_positions[i]);
                rosterPositions.splice(positionIndex, 1, playerInfo.fantasy_positions[i] + " " + playerInfo.full_name + " " + playerInfo.team);
                break;
            }
        }
         this.setState({
             rosterPositions: rosterPositions
         })
    }

  render() {
    const { playerInfo, isLoading, lastUpdate,loadingMessage,filteredPlayersIdsList, searchText, checkedItems, rankingPlayersIdsList, rosterPositions, leagueData, notFoundPlayers } = this.state;
    if (isLoading) {
      return <p>{ loadingMessage }</p>;
    } else {
      return (
      <div>
          <p className="latest-update"><i>Latest player DB update attempt: {new Date(lastUpdate).toString()}</i></p>
          <h1 className="title">Sleeper Team Assistant</h1>
          <div className="main-container">
              <div className="panel search-panel">
                  <div className="search">
                      <div className="position-filter">
                          <SearchFilterButton name={"QB"} handleChange={this.handleChange} labelName={"QB"} checked={checkedItems.includes("QB")} />
                          <SearchFilterButton name={"RB"} handleChange={this.handleChange} labelName={"RB"} checked={checkedItems.includes("RB")} />
                          <SearchFilterButton name={"WR"} handleChange={this.handleChange} labelName={"WR"} checked={checkedItems.includes("WR")} />
                          <SearchFilterButton name={"TE"} handleChange={this.handleChange} labelName={"TE"} checked={checkedItems.includes("TE")} />
                          <SearchFilterButton name={"K"} handleChange={this.handleChange} labelName={"K"} checked={checkedItems.includes("K")} />
                          <SearchFilterButton name={"DEF"} handleChange={this.handleChange} labelName={"DEF"} checked={checkedItems.includes("DEF")} />
                      </div>
                      <textarea className="input" value={searchText} onChange={this.updateSearchText} />
                      <button className="button" onClick={this.startLoad}>
                          Submit
                      </button>
                  </div>
                  <div className="player-grid">
                      {filteredPlayersIdsList.map(id => (
                          <PlayerInfoItem 
                              key={playerInfo[id].player_id} 
                              player={playerInfo[id]} 
                              addToRoster={this.addToRoster} 
                              rankingPlayersIdsList={rankingPlayersIdsList}
                          />
                      ))}
                      {notFoundPlayers.map((item, index) => (
                        <p key={item + new Date().getTime() + index}>{item}</p>
                      ))}
                  </div>
              </div>
              <div className="panel league-panel">
                  <div className="league-grid">
                      <p><b>{leagueData[2].name}</b></p>
                      <SearchBar allLeagueIDs={this.state.allLeagueIDs} leagueID={this.state.leagueID} updateLeagueID={this.updateLeagueID} getLeagueData={this.getLeagueData}/>
                  </div>
                  <div className="roster-positions">
                      {rosterPositions.map((pos, index) => (
                          <p key={pos + new Date().getTime() + index}>{pos}</p>
                      ))}
                  </div>
              </div>
          </div>
      </div>
    )};
  }
}

export default App;
