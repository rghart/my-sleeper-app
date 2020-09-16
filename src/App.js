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

  };

  componentDidMount() {
    this.getLeagueData();
  }

  getLeagueData = () => {
     const leagueID = "567115281182081024";
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

    handleChange = (e) => {
      const item = e.target.name;
      const index = this.state.checkedItems.indexOf(item);
      const checkedItems = this.state.checkedItems;
      index !== -1 ? checkedItems.splice(index, 1) : checkedItems.push(item);
      this.setState({ checkedItems: checkedItems });
      this.filterPlayers();
    }

    updateRankings = () => {
        let mostSearchedForPlayers = [];
        const playerInfo = this.state.playerInfo;
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
            for (const player in playerInfo) {
                if (nextSpring[i][2] === "Jr.") {
                    nextSpring[i].splice(1, 2, nextSpring[i][1] + " Jr.");
                }
                if (nextSpring[i][2] === "LA") {
                    nextSpring[i][2] = "LAR"
                }
                if (nextSpring[i][2] === "JAC") {
                    nextSpring[i][2] = "JAX"
                }
                if (nextSpring[i][0] === playerInfo[player].first_name.split("")[0] && playerInfo[player].last_name.includes(nextSpring[i][1]) && nextSpring[i][2] === playerInfo[player].team && (playerInfo[player].is_taken !== true || playerInfo[player].rostered_by === 'ryangh')) {
                    mostSearchedForPlayers.push(player);
                    break;
                }
            }
        }
        const newPlayers = mostSearchedForPlayers.filter(playerID => this.state.checkedItems.includes(this.state.playerInfo[playerID].position));
        this.setState({
            rankingPlayersIdsList: newPlayers,
            filteredPlayersIdsList: newPlayers
        })
    }

    filterPlayers = () => {
        const newPlayers = this.state.rankingPlayersIdsList.filter(playerID => this.state.checkedItems.includes(this.state.playerInfo[playerID].position));
        this.setState({
            filteredPlayersIdsList: newPlayers
        })
    }

  render() {
    const { playerInfo, isLoading, filteredPlayersIdsList, searchText, checkedItems } = this.state;
    if (isLoading) {
      return <p>Loading...</p>;
    } else {
      return (
      <div className="search">
        <SearchBar>
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
        {filteredPlayersIdsList.map(id => (
          <div key={id} className="single-player-item">
            <p><b>Player name: {playerInfo[id].full_name}</b></p>
            <p>Is rostered: {playerInfo[id].is_taken ? playerInfo[id].is_taken.toString() : "false"} </p>
            <p>Rostered by: {playerInfo[id].rostered_by ? playerInfo[id].rostered_by : "None"}</p>
            <p>Search rank: {playerInfo[id].search_rank.toString()}</p>
            <br/>
          </div>
        ))}
      </div>
    )};
  }
}

export default App;
