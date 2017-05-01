import React, { Component } from 'react';
import { AppRegistry, StyleSheet, Text, View } from 'react-native';

export default class Instasham extends Component {
  render() {
    return (
      <View >
        <Text>Yo</Text>
      </View>
    );
  }
}

const styles = StyleSheet.create({

});

AppRegistry.registerComponent('Instasham', () => Instasham);
