const {
  BaseNodeVisitor,
  ProgramNode,
  assertTypeStructNode,
  AccountNode,
} = require("@metaplex-foundation/kinobi");

class TransformDefinedTypesIntoAccountsVisitor extends BaseNodeVisitor {
  constructor(definedTypes) {
    super();
    this.definedTypes = definedTypes;
  }

  visitProgram(program) {
    const typesToExtract = program.definedTypes.filter((node) =>
      this.definedTypes.includes(node.name)
    );

    const newDefinedTypes = program.definedTypes.filter(
      (node) => !this.definedTypes.includes(node.name)
    );

    const newAccounts = typesToExtract.map((node) => {
      assertTypeStructNode(node.type);
      return new AccountNode(
        { ...node.metadata, size: null, discriminator: null, seeds: [] },
        node.type
      );
    });

    return new ProgramNode(
      program.metadata,
      [...program.accounts, ...newAccounts],
      program.instructions,
      newDefinedTypes,
      program.errors
    );
  }
}

exports.TransformDefinedTypesIntoAccountsVisitor =
  TransformDefinedTypesIntoAccountsVisitor;
