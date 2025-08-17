import Table from "cli-table3";
import chalk from "chalk";

// Helper function to display images in a table
export function displayImagesTable(images: any[]): void {
  const table = new Table({
    head: [
      chalk.white.bold('Name'), 
      chalk.white.bold('Type'),
      chalk.white.bold('License'), 
      chalk.white.bold('Category'),
      chalk.white.bold('Pricing'),
      chalk.white.bold('Source')
    ],
    style: {
      head: [],
      border: []
    }
  });
    
  // Add rows to the table
  images.forEach((image: any) => {
    table.push([
      image.name || 'N/A',
      image.type || 'N/A',
      image.metadata?.License || 'N/A',
      image.metadata?.Type || 'N/A',
      image.metadata?.Pricing || 'N/A',
      image.source || 'N/A'
    ]);
  });
  
  console.log(table.toString());
}
