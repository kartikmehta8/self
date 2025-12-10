pragma circom 2.1.9;

include "circomlib/circuits/comparators.circom";

template SingleOccurance(inputLength, wordLength) {
  signal input in[inputLength];
  signal input word[wordLength];

  // stores the matches cumulatively in a window
  signal match[inputLength - wordLength][wordLength + 1];
  // equality for each letter match, used in the previous variable
  signal equals[inputLength - wordLength][wordLength];
  // is equal for each window/word match
  signal matches[inputLength - wordLength];
  // stores the total number of matches
  signal count[inputLength - wordLength + 1];

  count[0] <== 0;

  for (var i = 0; i < inputLength - wordLength; i++) {
    match[i][0] <== 0;
    for (var j = 1; j <= wordLength; j++) {
      equals[i][j - 1] <== IsEqual()([in[i + j - 1], word[j - 1]]);
      match[i][j] <== match[i][j - 1] + equals[i][j - 1];
    }
    matches[i] <== IsEqual()([match[i][wordLength], wordLength]);
    count[i + 1] <== count[i] + matches[i];
  }

  1 === count[inputLength - wordLength];
}
