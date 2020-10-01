import React from 'react';
import './App.css';
import playerData from './sleeper_player_data';
import SearchBar from './SearchBar';
import SearchFilterButton from './SearchFilterButton';
import PlayerInfoItem from './PlayerInfoItem';

// Update player data with curl https://api.sleeper.app/v1/players/nfl --output sleeper_player_data.json

class App extends React.Component {
  state = {
    playerInfo: playerData,
    leagueData: [],
    isLoading: true,
    rankingPlayersIdsList: [],
    filteredPlayersIdsList: [],
    isTyping: false,
    searchText: "",
    checkedItems: ["QB", "RB", "WR", "TE", "K", "DEF"],
    showAvailable: true,
    showOnlyMyPlayers: true,
    leagueID: "521036158513700864",
    rosterPositions: [],
  };

  componentDidMount() {
    this.getLeagueData();
  }

  getLeagueData = async () => {
    const leagueID = this.state.leagueID;
    const urls = [
      `https://api.sleeper.app/v1/league/${leagueID}/rosters`,
      `https://api.sleeper.app/v1/league/${leagueID}/users`,
      `https://api.sleeper.app/v1/league/${leagueID}`
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
      this.setState({
        leagueData: data,
        isLoading: false,
        rosterPositions: data[2].roster_positions.filter(pos => pos !== "BN")
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
        let mostSearchedForPlayers = [];
        const playerInfoArray = Object.entries(this.state.playerInfo);
        let playerInfo = [];
        playerInfoArray.forEach(([key, value]) => {
            value.key = key;
            if (value.search_rank < 1000) {
                playerInfo.push(value);
            }
        })
        playerInfo.sort((a, b) => a.search_rank - b.search_rank);

        let rankString = this.state.searchText;
        let addLineBreak = rankString.replace(/(?:\r\n|\r|\n)/g, '<br>')
        let splitLineBreak = addLineBreak.split('<br>');
        let splitByPeriod = splitLineBreak.map(name => {
            let newArray = name.split('');
            newArray.splice(1, 1, " ");
            return newArray.join("");
        });

        let nextSpring = splitByPeriod.map(s => s.split(" "));
        for (let i = 0; i < nextSpring.length; i++) {
            if (nextSpring[i][3]) {
                nextSpring[i].splice(2, 1);
            }
            if (nextSpring[i][1].split("")[1] === ".") {
                nextSpring[i][1].split("").splice(0, 2);
            }
            if (nextSpring[i][2] === "LA") {
                nextSpring[i][2] = "LAR"
            }
            if (nextSpring[i][2] === "JAC") {
                nextSpring[i][2] = "JAX"
            }

            const findPlayer = (player) => {
                if (nextSpring[i][0] === player.first_name.split("")[0] && (player.last_name.includes(nextSpring[i][1]) || nextSpring[i][1].includes(player.last_name)) && nextSpring[i][2] === player.team) {
                    mostSearchedForPlayers.push(player.key);
                    return true;
                }
                return false;
            }
            let value = await playerInfo.find(findPlayer);
            if (!value) {
                console.log(`Couldn't find ${nextSpring[i][0] + " " + nextSpring[i][1] + " " + nextSpring[i][2] + " " + (i + 1)}`);
            }
        }

        await this.setState({
            rankingPlayersIdsList: mostSearchedForPlayers
        })
        this.filterPlayers();
    //    this.buildRoster();
    }

    filterPlayers = () => {
        const newPlayers = this.state.rankingPlayersIdsList.filter(playerID => this.state.checkedItems.includes(this.state.playerInfo[playerID].position) && (this.state.playerInfo[playerID].is_taken !== true || this.state.playerInfo[playerID].rostered_by === 'ryangh'));
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
    const { playerInfo, isLoading, filteredPlayersIdsList, searchText, checkedItems, rankingPlayersIdsList, rosterPositions, leagueData } = this.state;
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
            </div>
        <div className="league-grid">
            <p><b>{leagueData[2].name}</b></p>
            <SearchBar leagueID={this.state.leagueID} updateLeagueID={this.updateLeagueID} getLeagueData={this.getLeagueData}/>
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
