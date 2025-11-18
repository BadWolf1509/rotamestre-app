module.exports = {
  digestStringAsync: jest.fn().mockResolvedValue('abcd1234'),
  CryptoDigestAlgorithm: {
    MD5: 'MD5',
    SHA1: 'SHA1',
    SHA256: 'SHA256',
    SHA384: 'SHA384',
    SHA512: 'SHA512',
  },
};
