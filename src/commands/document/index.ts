// Collection commands
export { registerCollectionListCommand } from './collectionList';
export { registerCollectionCreateCommand } from './collectionCreate';
export { registerCollectionGetCommand } from './collectionGet';
export { registerCollectionDeleteCommand } from './collectionDelete';
export { registerCollectionUpdateCommand } from './collectionUpdate';

// Document commands
export { registerDocAddCommand } from './docAdd';
export { registerDocGetCommand } from './docGet';
export { registerDocDeleteCommand } from './docDelete';
export { registerDocUpdateCommand } from './docUpdate';
export { registerDocUploadFileCommand } from './docUploadFile';
export { registerDocSearchCommand } from './docSearch';

// API utilities
export { createDocumentApis, type DocumentApiInstances } from './apiUtils';
