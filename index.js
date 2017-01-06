import awsSdk from 'aws-sdk';

class AutoPrune {
  constructor(params = {}, numberOfVersionsToKeep = 5) {
    this.lambdaSdk = new awsSdk.Lambda(params);
    this.numberOfVersionsToKeep = numberOfVersionsToKeep;
  }

  async getAllFunctions() {
    let next;
    let functions = [];

    do {
      const params = next ? { Marker: next } : {};
      const response = await this.lambdaSdk.listFunctions(params).promise();

      next = response.NextMarker;
      functions = [...functions, ...response.Functions];
    } while (next)

    return functions;
  }

  async run() {
    try {
      const fun = await this.getAllFunctions();
      const functions = [fun[0]];

      console.log(`number of functions: ${functions.length}`);

      functions.forEach(async (f) => {
        const aliases = await this.lambdaSdk.listAliases({ FunctionName: f.FunctionName }).promise();

        console.log(`aliases for function ${JSON.stringify(f.FunctionName)}: ${JSON.stringify(aliases)}`);

        const versions = await this.lambdaSdk.listVersionsByFunction({ FunctionName: f.FunctionName }).promise();

        console.log(`versions for function ${JSON.stringify(f.FunctionName)}: ${JSON.stringify(versions)}`);

        let versionsToKeep = [...aliases.map((a) => {
          return a.FunctionVersion;
        }), '$LATEST'];

        console.log(`versionsToKeep before`);

        const sortedVersions = versions.Versions.sort((v1, v2) => {
          return v1.LastModified === v2.LastModified ? 0 :
            (v1.LastModified < v2.LastModified ? 1 : 0);
        });

        let numberOfVersionsToKeep = this.numberOfVersionsToKeep;

        sortedVersions.forEach((sortedVersion) => {
          if (numberOfVersionsToKeep > 0 &&
            sortedVersion.Version != '$LATEST' &&
            !versionsToKeep.find(sortedVersion.Version)) {
            versionsToKeep = [...versionsToKeep, sortedVersion.Version];
            --numberOfVersionsToKeep; 
          }
        });

        console.log(`versionsToKeep after: ${JSON.stringify(versionsToKeep)}`);

        versions.Versions.forEach((version) => {
          if (!versionsToKeep.find(version.Version)) {
            console.log(`Deleting version ${v.Version} of ${f.FunctionName} function`);
          }
        });
      });
    } catch (e) {
      console.log('error: ' + JSON.stringify(e));
    }
  }
}

var autoPrune = new AutoPrune();

autoPrune.run();
