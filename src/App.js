import React from 'react';
import './App.css';
import playerData from './sleeper_player_data';
import SearchBar from './SearchBar';
import SearchFilterButton from './SearchFilterButton';

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
    leagueID: "521036158513700864"
  };

  componentDidMount() {
    this.getLeagueData();
  }

  getLeagueData = () => {
    const leagueID = this.state.leagueID;
    const urls = [
      `https://api.sleeper.app/v1/league/${leagueID}/rosters`,
      `https://api.sleeper.app/v1/league/${leagueID}/users`
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
      this.setState({
        leagueData: data,
        isLoading: false
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
                console.log(`Couldn't find ${nextSpring[i][0] + " " + nextSpring[i][1] + " " + nextSpring[i][2]}`);
            }
        }

        await this.setState({
            rankingPlayersIdsList: mostSearchedForPlayers
        })
        this.filterPlayers();
    }

    filterPlayers = () => {
        const newPlayers = this.state.rankingPlayersIdsList.filter(playerID => this.state.checkedItems.includes(this.state.playerInfo[playerID].position) && (this.state.playerInfo[playerID].is_taken !== true || this.state.playerInfo[playerID].rostered_by === 'ryangh'));
        this.setState({
            filteredPlayersIdsList: newPlayers
        })
    }

  render() {
    const { playerInfo, isLoading, filteredPlayersIdsList, searchText, checkedItems, rankingPlayersIdsList } = this.state;
    if (isLoading) {
      return <p>Loading...</p>;
    } else {
      return (
      <div>
        <div className="search">
            <SearchBar leagueID={this.state.leagueID} updateLeagueID={this.updateLeagueID} getLeagueData={this.getLeagueData}>
              <SearchFilterButton name={"QB"} handleChange={this.handleChange} labelName={"QB"} checked={checkedItems.includes("QB")} />
              <SearchFilterButton name={"RB"} handleChange={this.handleChange} labelName={"RB"} checked={checkedItems.includes("RB")} />
              <SearchFilterButton name={"WR"} handleChange={this.handleChange} labelName={"WR"} checked={checkedItems.includes("WR")} />
              <SearchFilterButton name={"TE"} handleChange={this.handleChange} labelName={"TE"} checked={checkedItems.includes("TE")} />
              <SearchFilterButton name={"K"} handleChange={this.handleChange} labelName={"K"} checked={checkedItems.includes("K")} />
              <SearchFilterButton name={"DEF"} handleChange={this.handleChange} labelName={"DEF"} checked={checkedItems.includes("DEF")} />
            </SearchBar>
            <textarea value={searchText} onChange={this.updateSearchText} />
            <button onClick={this.updateRankings}>
                Submit
            </button>
        </div>
        {filteredPlayersIdsList.map(id => (
          <div key={id} className={`single-player-item ${playerInfo[id].position} ${playerInfo[id].is_taken ? "" : "available"}`}>
            <div className="player-name">
                <p><b>Player name: {playerInfo[id].full_name}</b></p>
                <p className="player-info-item">- {playerInfo[id].team}</p>
                <p className="player-info-item">({playerInfo[id].position})</p>
            </div>
            <div className="player-info">
                <p className="player-info-item"><b>Is rostered:</b> {playerInfo[id].is_taken ? playerInfo[id].is_taken.toString() : "false"} </p>
                <p className="player-info-item"><b>Rostered by:</b> {playerInfo[id].rostered_by ? playerInfo[id].rostered_by : "None"}</p>
                <p className="player-info-item"><b>Weekly rank:</b> {rankingPlayersIdsList.indexOf(id) + 1}</p>
            </div>
          </div>
        ))}
      </div>
    )};
  }
}

export default App;
