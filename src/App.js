import React from 'react';
import './App.css';
import SearchBar from './SearchBar';
import SearchFilterButton from './SearchFilterButton';
import PlayerInfoItem from './PlayerInfoItem';
import Fuse from 'fuse.js';

// No longer need to do this: Update player data with curl https://api.sleeper.app/v1/players/nfl --output sleeper_player_data.json
// TODO Write function that pulls from sleeper app API and updates firebase DB. Can only be run once per day per sleeper API docs. 
// Consider only having it run if it's the first time a user has visited the site that day

class App extends React.Component {
  state = {
    playerInfo: {},
    leagueData: [],
    isLoading: true,
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
  };

  componentDidMount() {
    this.getPlayerData();
  }

  getPlayerData = async () => {
    await fetch("https://sleeper-player-db-default-rtdb.firebaseio.com/.json")
    .then(response => response.json())
    .then(data => {
      this.setState({
        playerInfo: data
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
        console.log(data);
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
      rosterData[i].manager_display_name = currentManagerData.display_name;
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

    updateRankings = async () => {
        this.setState({
          isLoading: true,
          notFoundPlayers: [],
        });
        const playerInfoArray = Object.values(this.state.playerInfo);
        let { notFoundPlayers } = this.state;
        playerInfoArray.sort((a, b) => a.search_rank - b.search_rank);
        const playerInfoFuseOptions = {
            useExtendedSearch: true,
            includeScore: true,
            threshold: 0.5,
            keys: [
                "search_last_name",
                "search_first_name",
                "team",
                "position"
            ]
        }
        const options = {
          includeScore: true,
          threshold: 0.3,
        }
        const positions = ['QB', 'RB', 'WR', 'TE', 'DEF', 'K'];
        const teams = ['CAR', 'MIN', 'TEN', 'GB', 'NO', 'NYG', 'KC', 'IND', 'LAC', 'DAL', 'BUF', 'CLE', 'SEA', 'ARI', 'LV', 'ATL', 'LAR', 'LA', 'FA', 'CIN', 'SF', 'JAX', 'JAC', 'WAS', 'CHI', 'PHI', 'BAL', 'TB', 'DEN', 'HOU', 'PIT', 'MIA', 'DET', 'NE', 'NYJ', 'ROOKIE'];
        const playerInfoFuse = new Fuse(playerInfoArray, playerInfoFuseOptions);
        const teamsFuse = new Fuse(teams, options);

        let rankString = this.state.searchText;
        let addLineBreak = rankString.replace(/(?:\r\n|\r|\n)/g, '<br>')
        let splitLineBreak = addLineBreak.split('<br>');
        let searchResultsArray = [];
        let ranking = 1;

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
              const positionIndex = firstLastTeamArrays.findIndex(item => positions.includes(item));
              if (positionIndex >= 0) {
                foundPositionStr = firstLastTeamArrays.splice(positionIndex, 1)[0];
              }
              foundTeamStr = this.getHighestScore(firstLastTeamArrays, teamsFuse);
              if (foundTeamStr) {
                firstLastTeamArrays.splice(firstLastTeamArrays.indexOf(foundTeamStr), 1);
              }
            }
            searchArray = [firstLastTeamArrays[0], firstLastTeamArrays[1], foundTeamStr, foundPositionStr]
            let results = playerInfoFuse.search({
              $and: [
                  { 
                    $or: [
                      { search_first_name: searchArray[0].toLowerCase() },
                      { search_first_name: `^${searchArray[0].toLowerCase()}` }
                    ] 
                  },
                  { search_last_name: searchArray[1].toLowerCase() },
                  { team: searchArray[2] },
                  { position: searchArray[3] }
              ],
              // eslint-disable-next-line
              $and: [
                { 
                  $or: [
                    { search_first_name: searchArray[0].toLowerCase() },
                    { search_first_name: `^${searchArray[0].toLowerCase()}` }
                  ] 
                },
                { search_last_name: searchArray[1].toLowerCase() },
                { team: searchArray[2] }
              ],
              // eslint-disable-next-line
              $and: [
                { 
                  $or: [
                    { search_first_name: searchArray[0].toLowerCase() },
                    { search_first_name: `^${searchArray[0].toLowerCase()}` }
                  ] 
                },
                { search_last_name: searchArray[1].toLowerCase() },
                { position: searchArray[3] }
              ],
              // eslint-disable-next-line
              $and: [
                { 
                  $or: [
                    { search_first_name: searchArray[0].toLowerCase() },
                    { search_first_name: `^${searchArray[0].toLowerCase()}` }
                  ] 
                },
                { search_last_name: searchArray[1].toLowerCase() }
              ]
            });
            if (results[0] && results[0].score < 0.4) {
                searchResultsArray.push({player_id: results[0].item.player_id, ranking: ranking});
                if (results[0].item.search_rank > 500) {
                    console.log(`${results[0].item.full_name} ${results[0].item.position} ${results[0].item.team} Rank: ${ranking}`)
                }
            } else {
                notFoundPlayers.push(`Couldn't find ${firstLastTeamArrays[0]} ${firstLastTeamArrays[1]} ${firstLastTeamArrays[2]} Rank: ${ranking}`);
            }
            ranking += 1;
        })

        await this.setState({
          rankingPlayersIdsList: searchResultsArray,
          isLoading: false,
          notFoundPlayers: notFoundPlayers,
        })
        this.filterPlayers();
    //    this.buildRoster();
    }

    getHighestScore = (arr, fuseSearch) => {
        let bestResult = arr
          .map(item => fuseSearch.search(item))
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
        console.log(playerInfo);
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
    const { playerInfo, isLoading, filteredPlayersIdsList, searchText, checkedItems, rankingPlayersIdsList, rosterPositions, leagueData, notFoundPlayers } = this.state;
    if (isLoading) {
      return <p>Loading...</p>;
    } else {
      return (
      <div className="main-container">
        <div className="search">
            <div className="position-filter">
              <SearchFilterButton name={"QB"} handleChange={this.handleChange} labelName={"QB"} checked={checkedItems.includes("QB")} />
              <SearchFilterButton name={"RB"} handleChange={this.handleChange} labelName={"RB"} checked={checkedItems.includes("RB")} />
              <SearchFilterButton name={"WR"} handleChange={this.handleChange} labelName={"WR"} checked={checkedItems.includes("WR")} />
              <SearchFilterButton name={"TE"} handleChange={this.handleChange} labelName={"TE"} checked={checkedItems.includes("TE")} />
              <SearchFilterButton name={"K"} handleChange={this.handleChange} labelName={"K"} checked={checkedItems.includes("K")} />
              <SearchFilterButton name={"DEF"} handleChange={this.handleChange} labelName={"DEF"} checked={checkedItems.includes("DEF")} />
            </div>
            <textarea value={searchText} onChange={this.updateSearchText} />
            <button onClick={this.updateRankings}>
                Submit
            </button>
            </div>
            <div className="player-grid">
              {filteredPlayersIdsList.map(id => (
                <PlayerInfoItem player={playerInfo[id]} addToRoster={this.addToRoster} rankingPlayersIdsList={rankingPlayersIdsList}/>
              ))}
              {notFoundPlayers.map(item => (
                <p>{item}</p>
              ))}
            </div>
        <div className="league-grid">
            <p><b>{leagueData[2].name}</b></p>
            <SearchBar allLeagueIDs={this.state.allLeagueIDs} leagueID={this.state.leagueID} updateLeagueID={this.updateLeagueID} getLeagueData={this.getLeagueData}/>
        </div>
        <div className="roster-positions">
            {rosterPositions.map(pos => (
                <p>{pos}</p>
            ))}
        </div>
      </div>
    )};
  }
}

export default App;
