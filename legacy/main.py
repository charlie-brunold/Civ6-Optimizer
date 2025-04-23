import logging
from map_parser import MapParser

logger = logging.getLogger(__name__)

logging.basicConfig(
    filename='map_parser.log', level=logging.DEBUG,
    filemode='w',
    format='%(asctime)s - %(levelname)s - %(message)s'
)

def main():
    logger.info("Starting MapParser...")
    mp = MapParser("map_tiny_1_copy.csv")
    logger.info("Loading map data...")
    mp.load_map_data()
    logger.info("Complete")

if __name__ == "__main__":
    main()