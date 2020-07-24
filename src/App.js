import React from 'react';
import './App.css';
import playerData from './sleeper_player_data';

class App extends React.Component {
  state = {
    playerInfo: playerData,
    leagueData: [],
    isLoading: true,
    mostSearchedPlayers: [],
  };

  componentDidMount() {
    this.getLeagueData();
    this.mostSearchedForActive();
  }

  getLeagueData = () => {
    const urls = [
      'https://api.sleeper.app/v1/league/521036158513700864/rosters',
      'https://api.sleeper.app/v1/league/521036158513700864/users'
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
        isLoading: false
      });
    })
    .catch((error) => {
      console.error('Error:', error);
    });
  }

  markTakenPlayers = (rosterData, managerData) => {
    const rosters = rosterData;
    const managers = managerData;
    let playerObject = this.state.playerInfo;
    for (let i = 0; i < rosters.length; i++) {
      const currentManagerId = rosters[i].owner_id;
      const managerDisplayName = this.getManagerDisplayName(managers, currentManagerId);
      rosters[i].manager_display_name = managerDisplayName;
      rosters[i].players.forEach(player => {
        playerObject[player].is_taken = true;
        playerObject[player].rostered_by = managerDisplayName;
      })
    }
    this.setState({
      playerInfo: playerObject
    })
  }

  mostSearchedForActive = () => {
    let mostSearchedForPlayers = [];
    const playerInfo = this.state.playerInfo;
    for (const player in playerInfo) {
      if ((playerInfo[player].status !== "Inactive") && (playerInfo[player].search_rank < 500)) {
        mostSearchedForPlayers.push(player);
      }
    }
    mostSearchedForPlayers.sort((a, b) => playerInfo[a].search_rank - playerInfo[b].search_rank);
    this.setState({
      mostSearchedPlayers: mostSearchedForPlayers
    })
  }

  getManagerDisplayName = (managers, currentManagerId) => {
    for (let n = 0; n < managers.length; n++) {
      if (managers[n].user_id === currentManagerId) {
        let managerDisplayName = managers[n].display_name;
        return managerDisplayName;
      }
    }
  }

  render() {
    const { playerInfo, isLoading, mostSearchedPlayers } = this.state;
    if (isLoading) {
      return <p>Loading...</p>;
    } else {
      return (
      <div>
        {mostSearchedPlayers.map(id => (
          <div key={id}>
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
