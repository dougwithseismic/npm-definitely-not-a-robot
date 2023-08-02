# dougwithseismic/template-ts-npm-package

![GitHub Badge](https://img.shields.io/github/stars/dougwithseismic/template-ts-npm-package?style=social&label=Star)

A robust starting point for building npm packages with TypeScript support, and `esbuild` for rapidfire scaffolding.

## Features

- 🚀 Fast builds with [esbuild](https://esbuild.github.io/)
- 🦾 TypeScript support with type declarations
- 🚦 Ready-to-use scripts for development and building
- 🧪 Testing setup with Jest
- 📜 Linting with ESLint
- 🔄 Watch mode for development with nodemon and concurrently

## Getting Started

1. **Clone the repository**:

   ```bash
   git clone https://github.com/dougwithseismic/template-ts-npm-package.git your-package-name
   ```

2. **Navigate to the project directory**:

   ```bash
   cd your-package-name
   ```

3. **Install dependencies**:

   ```bash
   npm install
   ```

4. **Start Development**:

   ```bash
   npm run dev
   ```

   This will watch for changes in your `src` directory and rebuild as necessary.

5. **Build for Production**:

   ```bash
   npm run build
   ```

   This will generate the necessary files in the `dist` directory, ready for publishing to npm.

## Scripts

- `npm run build`: Produces production version of your library.
- `npm run dev`: Runs the library in development mode with watch for changes.
- `npm run test`: Run your tests using Jest.
- `npm run lint`: Lints your codebase using ESLint.

## Customizing the Template

To adapt this template for your own use, follow these customization steps:

1. **General Details**:
   - Update the `name`, `description`, and `version` in `package.json`.
   - Modify the `author` field with your own name and contact details in `package.json`.
   - If you have a different license preference, update the `license` field and provide the corresponding LICENSE file.

2. **Repository Details**:
   - Adjust the `repository`, `bugs`, and `homepage` URLs in `package.json` to point to your own repository.

3. **Funding & Support**:
   - If you have a different funding platform or URL, update the `funding` field in `package.json`.

4. **Contributors**:
   - Update the `contributors` field if your project has more contributors or if you want to provide more detailed contact information.

## Publishing to npm

1. **Login to npm**:

   If you haven't logged in to npm in your terminal or if you're new to npm, run:

   ```bash
   npm login
   ```

   Follow the prompts to enter your username, password, and email address.

2. **Publishing**:

   Before publishing, ensure you've built the package for production using:

   ```bash
   npm run build
   ```

   Then, simply publish using:

   ```bash
   npm publish
   ```

3. **Understanding the Publishing Process**:

   - Thanks to the `files` array in `package.json`, only the `dist` directory and the `README.md` file will be uploaded to npm. This ensures a lightweight package for your users.
   - Your `.npmignore` file can further refine what gets excluded from the npm package.

4. **Versioning**:

   Always update the version number in `package.json` before publishing a new release. Use [semantic versioning](https://semver.org/) to clearly communicate changes. Semantic versioning (or SemVer) is a versioning scheme where each version number consists of three parts: `MAJOR.MINOR.PATCH`, indicating breaking changes, additive changes, and bug fixes respectively.

## Type Declarations

The magic behind the type declarations in this setup is the combination of TypeScript and the build tools:

- The script `"build:types": "tsc --emitDeclarationOnly"` in `package.json` is responsible for generating type declaration files without emitting JavaScript code. This means when you run the build script, TypeScript will automatically generate the type declarations for your package.
  
- These type declarations are bundled in the `dist` directory, which gets uploaded to npm when you publish. This ensures that anyone installing your package also gets the type declarations, making it easier to use your package in TypeScript projects.

## Importing and Using the Your Package Once Published

### Installing the Package

First, you need to install the package from npm:

```bash
npm install package-name
```

or with Yarn:

```bash
yarn add package-name
```

### Using the Package in Your Code

The package provides both default and named exports for maximum flexibility. Here's how you can import and use them:

#### Importing the Default Export

The default export is the primary functionality provided by the package. To import and use it:

```typescript
import defaultExport from 'package-name';

// Use the defaultExport in your code
defaultExport();
```

#### Importing Types or Other Named Exports

If you need any specific types or utilities provided by the package, you can import them alongside the default export:

```typescript
import defaultExport, { SomeType } from 'package-name';

// Using the type in your code
const someVariable: SomeType = {
  // ...your object structure here
};
```

Or, if you only need the named exports:

```typescript
import { SomeType } from 'package-name';

// Using the type in your code
const someVariable: SomeType = {
  // ...your object structure here
};
```

Feel free to adjust the above section to better fit the specifics of your package and its exports.

## Contributing

If you find any problems, please [open an issue](https://github.com/dougwithseismic/template-ts-npm-package/issues) or submit a fix as a pull request.

## Support

Like the project? ⭐ Star the repository to show support or [support the author directly](https://gimme.fan/@dougiesilkstone).

## Author

- [Doug Silkstone](https://twitter.com/dougiesilkstone)
